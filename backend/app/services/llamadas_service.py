from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models import SeguimientoLlamada


def crear_llamada(db: Session, datos: dict) -> SeguimientoLlamada:
    llamada = SeguimientoLlamada(**datos)
    db.add(llamada)
    db.commit()
    db.refresh(llamada)
    return llamada


def historial_por_empleado(db: Session, id_empleado: int) -> list[SeguimientoLlamada]:
    return (
        db.query(SeguimientoLlamada)
        .filter(SeguimientoLlamada.id_empleado == id_empleado)
        .order_by(SeguimientoLlamada.fecha_contacto.desc())
        .all()
    )


_ULTIMA_LLAMADA_SQL = text(
    """
    SELECT DISTINCT ON (id_empleado)
        id, id_empleado, fecha_contacto, resultado, medio_contacto,
        motivo_bajo_rendimiento, proxima_accion, fecha_proximo_seguimiento, registrado_por
    FROM seguimiento_llamada
    WHERE id_empleado = ANY(:ids)
    ORDER BY id_empleado, fecha_contacto DESC
    """
)


def ultimas_llamadas_por_empleado(db: Session, ids: list[int]) -> dict[int, dict]:
    """Una fila por empleado (la más reciente), para enriquecer las listas de alerta.

    Vacío si `ids` está vacío — evita mandar `= ANY(ARRAY[])` con tipo ambiguo a Postgres.
    """
    if not ids:
        return {}
    filas = db.execute(_ULTIMA_LLAMADA_SQL, {"ids": ids}).mappings().all()
    return {fila["id_empleado"]: dict(fila) for fila in filas}
