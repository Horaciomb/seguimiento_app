"""Disponibilidad horaria de cada persona: de dónde sale y cómo se registra.

El dato NO lo calcula Lab 001 ni vive completo en ninguna de sus tablas:

  - `empleado_unidad.disponibilidad_tiempo` existe pero está 100% NULL (verificado en
    `rrhh_bd_dev` el 2026-09-01). Se lee igual, por si algún día Lab 001 empieza a llenarla.
  - `proceso_reclutamiento.disponibilidad_tiempo` sí tiene dato, pero es texto libre del
    formulario de reclutamiento y sólo cubre a quien entró por ahí (~20% de los afiliadores
    en alerta; el resto es personal legado).

Entonces hay dos niveles, y el de más arriba gana:

  1. `seguimiento_disponibilidad` (tabla propia) — lo que confirmó quien llamó.
  2. Heredado de Lab 001 (`empleado_unidad`, si no `proceso_reclutamiento`), normalizado.

`origen` viaja hasta la UI para que se vea la diferencia entre "esto lo confirmó alguien
por teléfono" y "esto es lo que puso en el formulario cuando entró".
"""
import unicodedata

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from ..models import DISPONIBILIDADES_VALIDAS, SeguimientoDisponibilidad

# Texto libre de reclutamiento -> código propio. Las claves están sin acentos y en
# minúsculas (ver `_normalizar`), porque el formulario mezcla "Turno Mañana" con "Tarde".
_SINONIMOS = {
    "tiempo completo": "TIEMPO_COMPLETO",
    "completo": "TIEMPO_COMPLETO",
    "full time": "TIEMPO_COMPLETO",
    "medio tiempo": "MEDIO_TIEMPO",
    "medio turno": "MEDIO_TIEMPO",
    "part time": "MEDIO_TIEMPO",
    "turno manana": "TURNO_MANANA",
    "manana": "TURNO_MANANA",
    "turno tarde": "TURNO_TARDE",
    "tarde": "TURNO_TARDE",
}

ETIQUETAS = {
    "TIEMPO_COMPLETO": "Tiempo completo",
    "MEDIO_TIEMPO": "Medio tiempo",
    "TURNO_MANANA": "Turno mañana",
    "TURNO_TARDE": "Turno tarde",
    "NO_DEFINIDO": "No definido",
}
ETIQUETA_SIN_DATO = "Sin dato"


def _normalizar(valor: str | None) -> str | None:
    """Texto libre de reclutamiento -> uno de DISPONIBILIDADES_VALIDAS (o None si no hay).

    Lo que no se reconoce cae en NO_DEFINIDO en vez de descartarse: que el formulario haya
    traído algo raro ("Tiempo Imparcial", visto en dev) no es lo mismo que no tener dato,
    y así la UI puede pedir que alguien lo confirme por teléfono.
    """
    if valor is None:
        return None
    crudo = valor.strip()
    if not crudo:
        return None
    if crudo.upper() in DISPONIBILIDADES_VALIDAS:
        return crudo.upper()
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFD", crudo.lower()) if unicodedata.category(c) != "Mn"
    )
    return _SINONIMOS.get(" ".join(sin_acentos.split()), "NO_DEFINIDO")


_DISPONIBILIDAD_SQL = text(
    """
    WITH emp AS (
        SELECT id_empleado, id_persona, disponibilidad_tiempo
        FROM empleado_unidad
        WHERE id_empleado = ANY(:ids)
    ),
    reclutamiento AS (
        SELECT DISTINCT ON (pr.id_persona) pr.id_persona, pr.disponibilidad_tiempo
        FROM proceso_reclutamiento pr
        JOIN emp e ON e.id_persona = pr.id_persona
        WHERE COALESCE(pr.disponibilidad_tiempo, '') <> ''
        ORDER BY pr.id_persona, pr.fecha_llenado_formulario DESC NULLS LAST, pr.id_proceso DESC
    )
    SELECT e.id_empleado,
           sd.disponibilidad       AS registrada,
           sd.registrado_por,
           sd.fecha_actualizacion,
           e.disponibilidad_tiempo AS heredada_empleado,
           r.disponibilidad_tiempo AS heredada_reclutamiento
    FROM emp e
    LEFT JOIN reclutamiento r ON r.id_persona = e.id_persona
    LEFT JOIN seguimiento_disponibilidad sd ON sd.id_empleado = e.id_empleado
    """
)


def disponibilidades_por_empleado(db: Session, ids: list[int]) -> dict[int, dict]:
    """{id_empleado: {disponibilidad, disponibilidad_label, origen, ...}} para esos ids.

    Vacío si `ids` está vacío — mismo motivo que en llamadas_service: evitar mandar
    `= ANY(ARRAY[])` con tipo ambiguo a Postgres.
    """
    if not ids:
        return {}

    resultado: dict[int, dict] = {}
    for fila in db.execute(_DISPONIBILIDAD_SQL, {"ids": ids}).mappings().all():
        registrada = _normalizar(fila["registrada"])
        if registrada:
            codigo, origen = registrada, "REGISTRADA"
        else:
            heredada = _normalizar(fila["heredada_empleado"]) or _normalizar(
                fila["heredada_reclutamiento"]
            )
            codigo, origen = (heredada, "RECLUTAMIENTO") if heredada else (None, None)

        resultado[fila["id_empleado"]] = {
            "disponibilidad": codigo,
            "disponibilidad_label": ETIQUETAS.get(codigo, ETIQUETA_SIN_DATO),
            "disponibilidad_origen": origen,
            "disponibilidad_registrado_por": fila["registrado_por"] if origen == "REGISTRADA" else None,
            "disponibilidad_actualizada": fila["fecha_actualizacion"] if origen == "REGISTRADA" else None,
        }
    return resultado


def guardar_disponibilidad(
    db: Session, id_empleado: int, disponibilidad: str, registrado_por: str | None = None
) -> SeguimientoDisponibilidad:
    """Upsert: una fila por empleado, la última confirmación pisa a la anterior."""
    fila = db.get(SeguimientoDisponibilidad, id_empleado)
    if fila is None:
        fila = SeguimientoDisponibilidad(id_empleado=id_empleado)
        db.add(fila)
    fila.disponibilidad = disponibilidad
    fila.registrado_por = registrado_por
    fila.fecha_actualizacion = func.now()
    db.flush()
    return fila
