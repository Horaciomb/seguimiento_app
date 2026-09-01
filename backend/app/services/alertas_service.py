"""Consultas de lectura sobre las vistas de indicadores de Lab 001 (`rrhh_bd`).

Cada función reproduce, a propósito, el MISMO filtro que ya está verificado en el
export correspondiente del Lab — no se reinventa ningún criterio de negocio acá.
Ver `contexto_indicadores.md` para el porqué de cada filtro:

  - Inactividad  -> mismo criterio que 14_alerta_inactividad_afiliadores.py / hoja "alerta"
  - Turnos       -> mismo criterio que 15_actividad_por_turno.py / hoja "alerta" (2026-08-28)
  - Reincidencia -> misma query y agrupación que 17_exportar_alerta_turnos.py
  - Producción MTD -> mismos 4 filtros que 18b_exportar_produccion_mtd.py

Nada de acá escribe en las tablas o vistas de Lab 001.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session

from .disponibilidad_service import ETIQUETA_SIN_DATO, disponibilidades_por_empleado
from .llamadas_service import ultimas_llamadas_por_empleado

# Sólo para Reincidencia: ese indicador nació para detectar el HÁBITO de cargar fuera de
# horario (operador `>`), así que sigue mirando NOCHE/MADRUGADA — mismo criterio que
# 17_exportar_alerta_turnos.py, para que sus números sigan cuadrando con el Excel del Lab.
# La pestaña de Turnos, en cambio, muestra los 4 turnos (ver _TURNOS_SQL).
_TURNOS_REINCIDENCIA = "('NOCHE','MADRUGADA')"


# Sin dato de disponibilidad: se manda igual (con label "Sin dato") en vez de omitir las
# claves, para que el filtro por disponibilidad de la UI tenga una opción con la que
# encontrar justamente a quienes falta preguntarles.
_DISPONIBILIDAD_VACIA = {
    "disponibilidad": None,
    "disponibilidad_label": ETIQUETA_SIN_DATO,
    "disponibilidad_origen": None,
    "disponibilidad_registrado_por": None,
    "disponibilidad_actualizada": None,
}


def _enriquecer_con_ultima_llamada(db: Session, filas: list[dict]) -> list[dict]:
    """Agrega, por fila, la última llamada registrada y la disponibilidad de la persona.

    Dos consultas por lista completa (no una por fila) — el mismo criterio con el que se
    resolvió el enriquecimiento de "última llamada" desde el principio.
    """
    ids = [f["id_empleado"] for f in filas]
    ultimas = ultimas_llamadas_por_empleado(db, ids)
    disponibilidades = disponibilidades_por_empleado(db, ids)
    for f in filas:
        f["ultima_llamada"] = ultimas.get(f["id_empleado"])
        f.update(disponibilidades.get(f["id_empleado"], _DISPONIBILIDAD_VACIA))
    return filas


_INACTIVIDAD_SQL = text(
    """
    SELECT id_empleado, ci, nombre_completo, supervisor, ciudad, departamento,
           unidad_negocio, campana, telefono, fecha_ingreso, fecha_ultima_afiliacion,
           dias_inactividad, tramo, estado_medicion, horas_desde_el_calculo
    FROM vw_alerta_inactividad
    WHERE estado_medicion = 'MEDIDO'
      AND tramo IN ('SEGUIMIENTO', 'CRITICO', 'REVISAR BAJA')
    ORDER BY dias_inactividad DESC
    """
)


def get_inactividad(db: Session) -> list[dict]:
    filas = [dict(f) for f in db.execute(_INACTIVIDAD_SQL).mappings().all()]
    return _enriquecer_con_ultima_llamada(db, filas)


_TURNOS_SQL = text(
    """
    WITH ultima_fecha AS (
        SELECT turno, MAX(fecha) AS fecha
        FROM vw_alerta_turnos
        GROUP BY turno
    )
    SELECT v.id_empleado, v.ci, v.nombre_completo, v.supervisor, v.ciudad, v.departamento,
           v.unidad_negocio, v.campana, v.telefono, v.fecha, v.turno, v.cantidad,
           v.operador, v.umbral
    FROM vw_alerta_turnos v
    JOIN ultima_fecha uf ON uf.turno = v.turno AND uf.fecha = v.fecha
    WHERE v.alerta
    ORDER BY v.turno,
             -- "Peor primero" depende del operador del umbral: con `<` (bajo rendimiento en
             -- MAÑANA/TARDE) lo grave es la cantidad más baja; con `>` (carga fuera de
             -- horario en NOCHE/MADRUGADA) lo grave es la más alta.
             CASE WHEN v.operador = '<' THEN v.cantidad ELSE -v.cantidad END
    """
)


def get_turnos(db: Session) -> list[dict]:
    """Último cálculo de CADA turno en alerta — no una ventana de días.

    Los 4 turnos, no sólo NOCHE/MADRUGADA (2026-09-01): la vista ya calcula también el bajo
    rendimiento de MAÑANA y TARDE (umbral `< 5`) y no había forma de verlo desde la app.
    Se separan en la UI con el filtro por `turno`, que ya existía.

    Cada turno entra con SU propia última fecha calculada (el `GROUP BY turno` del CTE) —
    Lab 001 no siempre cierra los 4 el mismo día.
    """
    filas = [dict(f) for f in db.execute(_TURNOS_SQL).mappings().all()]
    return _enriquecer_con_ultima_llamada(db, filas)


_REINCIDENCIA_SQL = text(
    f"""
    SELECT fecha, turno, unidad_negocio, campana, id_empleado, ci, nombre_completo,
           supervisor, telefono, ciudad, departamento, cantidad, operador, umbral
    FROM vw_alerta_turnos
    WHERE alerta
      AND turno IN {_TURNOS_REINCIDENCIA}
      AND fecha >= CURRENT_DATE - (:dias || ' days')::interval
    ORDER BY fecha DESC, turno, nombre_completo
    """
)


def get_reincidencia(db: Session, dias: int = 30, minimo_veces: int = 3) -> list[dict]:
    """Replica armar_resumen_por_persona() de 17_exportar_alerta_turnos.py.

    Las filas llegan ordenadas `fecha DESC` — igual que el script original — así que
    "la primera fila que se ve de esa persona" (de donde salen supervisor/unidad/
    campaña/teléfono, snapshot no actualizado) es la más reciente dentro de la ventana.
    """
    filas = db.execute(_REINCIDENCIA_SQL, {"dias": dias}).mappings().all()

    resumen: dict[int, dict] = {}
    for f in filas:
        id_empleado = f["id_empleado"]
        r = resumen.get(id_empleado)
        if r is None:
            resumen[id_empleado] = {
                "id_empleado": id_empleado,
                "ci": f["ci"],
                "nombre_completo": f["nombre_completo"],
                "supervisor": f["supervisor"],
                "ciudad": f["ciudad"],
                "departamento": f["departamento"],
                "unidad_negocio": f["unidad_negocio"],
                "campana": f["campana"],
                "telefono": f["telefono"],
                "veces_en_alerta": 1,
                "primera_fecha": f["fecha"],
                "ultima_fecha": f["fecha"],
            }
        else:
            r["veces_en_alerta"] += 1
            if f["fecha"] < r["primera_fecha"]:
                r["primera_fecha"] = f["fecha"]
            if f["fecha"] > r["ultima_fecha"]:
                r["ultima_fecha"] = f["fecha"]

    resultado = [r for r in resumen.values() if r["veces_en_alerta"] >= minimo_veces]
    resultado.sort(key=lambda r: (r["unidad_negocio"] or "", -r["veces_en_alerta"], r["supervisor"] or ""))
    return _enriquecer_con_ultima_llamada(db, resultado)


_PRODUCCION_MTD_SQL = text(
    """
    WITH excluidos_inactividad AS (
        SELECT id_empleado FROM vw_alerta_inactividad
        WHERE estado_medicion = 'MEDIDO' AND tramo IN ('SEGUIMIENTO', 'CRITICO', 'REVISAR BAJA')
    ),
    -- A propósito sólo NOCHE/MADRUGADA, aunque la pestaña de Turnos ya muestre los 4:
    -- este es uno de los 4 filtros de 18b_exportar_produccion_mtd.py. Sumar MAÑANA/TARDE
    -- acá excluiría de Producción MTD a casi toda la población (con umbral `< 5`, ~90% de
    -- los medidos alertan) y vaciaría la pestaña.
    ultima_fecha_turno AS (
        SELECT turno, MAX(fecha) AS fecha
        FROM vw_alerta_turnos
        WHERE turno IN ('NOCHE', 'MADRUGADA')
        GROUP BY turno
    ),
    excluidos_turnos AS (
        SELECT v.id_empleado
        FROM vw_alerta_turnos v
        JOIN ultima_fecha_turno uf ON uf.turno = v.turno AND uf.fecha = v.fecha
        WHERE v.alerta
    )
    SELECT p.id_empleado, p.ci, p.nombre_completo, p.supervisor, p.ciudad, p.departamento,
           p.unidad_negocio, p.campana, p.telefono,
           p.produccion_actual_mtd, p.promedio_historico_mtd
    FROM vw_produccion_mtd_vs_historico p
    WHERE p.estado_medicion = 'MEDIDO'
      AND p.promedio_historico_mtd >= 10
      AND p.produccion_actual_mtd <= p.promedio_historico_mtd
      AND p.id_empleado NOT IN (SELECT id_empleado FROM excluidos_inactividad)
      AND p.id_empleado NOT IN (SELECT id_empleado FROM excluidos_turnos)
    ORDER BY p.unidad_negocio, p.produccion_actual_mtd, p.supervisor
    """
)


def _accion_sugerida(cumplimiento_pct: float) -> str:
    if cumplimiento_pct >= 0.80:
        return "Llamada de motivación"
    if cumplimiento_pct >= 0.50:
        return "Llamada de seguimiento"
    return "Coordinación con subgerente"


def get_produccion_mtd(db: Session) -> list[dict]:
    filas = []
    for f in db.execute(_PRODUCCION_MTD_SQL).mappings().all():
        promedio = float(f["promedio_historico_mtd"])
        actual = f["produccion_actual_mtd"]
        cumplimiento_pct = actual / promedio if promedio else 0.0
        filas.append(
            {
                **dict(f),
                "variacion": actual - promedio,
                "cumplimiento_pct": cumplimiento_pct,
                "accion_sugerida": _accion_sugerida(cumplimiento_pct),
            }
        )
    return _enriquecer_con_ultima_llamada(db, filas)
