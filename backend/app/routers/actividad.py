"""Consulta del movimiento registrado en la app (las 3 tablas propias)."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ActividadPageOut, RegistradorOut
from ..services import actividad_service

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
