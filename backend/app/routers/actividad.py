"""Consulta del movimiento registrado en la app (las 3 tablas propias)."""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ActividadPageOut, RegistradorOut
from ..services import actividad_service, excel_service

router = APIRouter(prefix="/actividad", tags=["actividad"])


@router.get("", response_model=ActividadPageOut)
def listar_actividad(
    desde: Optional[date] = Query(None, description="Día inicial, en hora de Bolivia"),
    hasta: Optional[date] = Query(None, description="Día final INCLUSIVO, en hora de Bolivia"),
    registrado_por: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Nombre o CI del afiliador/supervisor"),
    pagina: int = Query(1, ge=1),
    por_pagina: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """La línea de tiempo paginada.

    `total` es el del filtro completo, no el de la página: la barra de paginación necesita
    saber cuántas hay en total para poder ofrecer "Siguiente".

    `por_pagina` se RECHAZA con 422 si supera 100, no se recorta en silencio: un recorte
    mudo devolvería 100 filas de las 999 pedidas y quien llama las leería como el universo
    completo. Mismo criterio que el aviso de recorte del export.
    """
    filtros = dict(desde=desde, hasta=hasta, registrado_por=registrado_por, q=q)
    items = actividad_service.listar(
        db, **filtros, limite=por_pagina, offset=(pagina - 1) * por_pagina
    )
    return {"items": items, "total": actividad_service.contar(db, **filtros)}


# ⚠️ Declarada DESPUÉS de la ruta raíz pero con path propio: no hay conflicto porque `""`
# no captura segmentos. Si algún día se agrega `/{algo}`, esta tiene que ir ANTES.
@router.get("/registradores", response_model=list[RegistradorOut])
def listar_registradores(db: Session = Depends(get_db)):
    """Quiénes registraron algo, con su conteo — para poblar el select.

    Sin filtros a propósito: si respetara el rango de fechas de la pantalla, mover las
    fechas vaciaría el select y dejaría a quien busca sin poder elegir a nadie.
    """
    return actividad_service.registradores(db)


# El caso de uso es bajarse el período completo, así que el techo es alto; 5000 deja margen
# de años sin volverse ilimitado. Mismo número que `LIMITE_EXPORT_PLANILLA` en rrhh-app.
LIMITE_EXPORT = 5000

_MOTIVO_LABEL = {
    "SALUD": "Salud",
    "PERSONAL_FAMILIAR": "Personal/familiar",
    "OTRO_TRABAJO": "Consiguió otro trabajo",
    "NO_LE_GUSTA_TURNO": "No le gusta el turno/proyecto",
    "PAGO_COMISIONES": "Pago/comisiones",
    "DIFICULTAD_SISTEMA": "Dificultad con el sistema",
    "SIN_MOTIVO_CLARO": "Sin motivo claro",
    "OTRO": "Otro",
}

_TIPO_LABEL = {
    "AFILIADOR": "Contacto a afiliador",
    "SUPERVISOR": "Contacto a supervisor",
    "DISPONIBILIDAD": "Disponibilidad confirmada",
}

_FUENTE_LABEL = {
    "INACTIVIDAD": "Inactividad",
    "TURNOS": "Turnos",
    "REINCIDENCIA": "Reincidencia",
    "PRODUCCION_MTD": "Producción MTD",
}


def _afiliadores(fila: dict) -> str | None:
    """Los N afiliadores de un contacto a supervisor, en una celda.

    Sale del snapshot congelado, no de la alerta de hoy: la métrica que motivó el mensaje
    ("45 días sin afiliar") ya no existe en ninguna vista al día siguiente.
    """
    lista = (fila.get("detalle") or {}).get("afiliadores") or []
    partes = [
        " ".join(p for p in (a.get("nombre"), f"({a['metrica']})" if a.get("metrica") else None) if p)
        for a in lista
    ]
    return " · ".join(partes) or None


_COLUMNAS = [
    ("Fecha y hora",             lambda f: f.get("fecha")),
    ("Tipo",                     lambda f: _TIPO_LABEL.get(f.get("tipo"), f.get("tipo"))),
    ("Persona / supervisor",     lambda f: f.get("sujeto_nombre")),
    ("CI",                       lambda f: f.get("sujeto_ci")),
    ("Indicador",                lambda f: _FUENTE_LABEL.get(f.get("indicador"), f.get("indicador"))),
    ("Resultado",                lambda f: f.get("resultado")),
    ("Medio",                    lambda f: f.get("medio")),
    ("Quién registró",           lambda f: f.get("registrado_por")),
    ("Motivo",                   lambda f: _MOTIVO_LABEL.get(
        (f.get("detalle") or {}).get("motivo_bajo_rendimiento"),
        (f.get("detalle") or {}).get("motivo_bajo_rendimiento"))),
    ("Próxima acción",           lambda f: (f.get("detalle") or {}).get("proxima_accion")),
    ("Fecha de seguimiento",     lambda f: (f.get("detalle") or {}).get("fecha_proximo_seguimiento")),
    ("Notas",                    lambda f: (f.get("detalle") or {}).get("notas")),
    ("Afiliadores mencionados",  _afiliadores),
    ("Cantidad de afiliadores",  lambda f: (f.get("detalle") or {}).get("cantidad_afiliadores")),
    ("Disponibilidad confirmada", lambda f: (f.get("detalle") or {}).get("disponibilidad")),
]


@router.get("/export.xlsx")
def exportar_actividad(
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    registrado_por: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """El mismo filtro que la pantalla, en un `.xlsx`.

    Ignora `pagina`/`por_pagina` a propósito: se exporta el resultado del filtro, no la
    página que se está viendo.

    🔴 **El recorte no puede ser silencioso.** Un archivo topado se lee como el universo
    completo y alguien decide sobre datos que no están; por eso van las dos cabeceras y el
    frontend las compara siempre.
    """
    filtros = dict(desde=desde, hasta=hasta, registrado_por=registrado_por, q=q)
    filas = actividad_service.listar(db, **filtros, limite=LIMITE_EXPORT, offset=0)
    total = actividad_service.contar(db, **filtros)

    buffer = excel_service.construir_xlsx(
        titulo_hoja="Movimiento", columnas=_COLUMNAS, filas=filas,
    )
    sello = datetime.now().strftime("%Y%m%d-%H%M")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="actividad-{sello}.xlsx"',
            "X-Filas-Exportadas": str(len(filas)),
            "X-Total-Disponible": str(total),
            # Sin esto el navegador no deja leer las dos cabeceras desde JS.
            "Access-Control-Expose-Headers": "X-Filas-Exportadas, X-Total-Disponible",
        },
    )
