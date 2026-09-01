"""Contacto del supervisor a cargo de cada afiliador.

Las 3 vistas de Lab 001 (`vw_alerta_inactividad`, `vw_alerta_turnos`,
`vw_produccion_mtd_vs_historico`) exponen `supervisor` sólo como TEXTO — el nombre armado
con `CONCAT_WS` sobre la tabla `persona`, o `'(sin asignar)'`. No exponen ni el id ni el
teléfono, así que con lo que ya traen las queries de alerta no hay forma de escribirle.

El camino existe igual y no obliga a tocar Lab 001:

    empleado_unidad.id_empleado -> eu.id_persona_supervisor -> persona.telefono

Se usa `persona.telefono` y no la fila `empleado_unidad` del propio supervisor por dos
razones (medidas contra las bases reales el 2026-09-01):

  - Cobertura: en `rrhh_bd` (prod), de 405 filas en alerta de turnos, 384 tienen teléfono
    por `persona` — en `rrhh_bd_dev`, 108 de 119 en Inactividad contra 104 por
    `empleado_unidad`.
  - Cardinalidad: `persona` es una fila por `id_persona`; `empleado_unidad` tiene personas
    con más de una fila activa (4 en dev), que multiplicarían filas de alerta en el JOIN.

`id_persona_supervisor` es una referencia BLANDA sin FK en el propio Lab 001
(`01_create_tables.sql`: "Ref BLANDA a persona, SIN FK"), y puede venir NULL: en prod la
tienen 423 de 449 empleados activos. Por eso todo acá es `LEFT JOIN` y las filas sin
supervisor viajan igual con los campos en `None` — la UI las agrupa bajo "(sin asignar)",
que es justamente a quienes hay que resolverles el dato.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session

SUPERVISOR_VACIO = {"id_persona_supervisor": None, "supervisor_telefono": None}

_SUPERVISOR_SQL = text(
    """
    SELECT eu.id_empleado,
           eu.id_persona_supervisor,
           p.telefono AS supervisor_telefono
    FROM empleado_unidad eu
    LEFT JOIN persona p ON p.id_persona = eu.id_persona_supervisor
    WHERE eu.id_empleado = ANY(:ids)
    """
)


def datos_supervisor_por_empleado(db: Session, ids: list[int]) -> dict[int, dict]:
    """Una consulta por lista completa, no una por fila.

    Mismo criterio que `ultimas_llamadas_por_empleado` y `disponibilidades_por_empleado`.
    Vacío si `ids` está vacío — evita mandar `= ANY(ARRAY[])` con tipo ambiguo a Postgres.
    """
    if not ids:
        return {}
    filas = db.execute(_SUPERVISOR_SQL, {"ids": ids}).mappings().all()
    return {
        fila["id_empleado"]: {
            "id_persona_supervisor": fila["id_persona_supervisor"],
            "supervisor_telefono": fila["supervisor_telefono"],
        }
        for fila in filas
    }
