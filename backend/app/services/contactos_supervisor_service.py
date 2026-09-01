"""Log de contactos al supervisor a cargo (tabla propia, migración 004).

Mismo par de operaciones que `llamadas_service`, pero con el supervisor como sujeto:
insertar el contacto, listar su historial, y traer el último de cada uno en UNA consulta
para enriquecer la lista agrupada sin una query por grupo.
"""
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models import SeguimientoContactoSupervisor


def crear_contacto(db: Session, datos: dict) -> SeguimientoContactoSupervisor:
    """`cantidad_afiliadores` se deriva acá, no llega del cliente: son dos vistas del
    mismo hecho y no tiene sentido dejar que se desincronicen."""
    datos = {**datos, "cantidad_afiliadores": len(datos.get("afiliadores") or [])}
    contacto = SeguimientoContactoSupervisor(**datos)
    db.add(contacto)
    db.commit()
    db.refresh(contacto)
    return contacto


def historial_por_supervisor(db: Session, id_persona_supervisor: int) -> list[SeguimientoContactoSupervisor]:
    return (
        db.query(SeguimientoContactoSupervisor)
        .filter(SeguimientoContactoSupervisor.id_persona_supervisor == id_persona_supervisor)
        .order_by(SeguimientoContactoSupervisor.fecha_contacto.desc())
        .all()
    )


_ULTIMO_CONTACTO_SQL = text(
    """
    SELECT DISTINCT ON (id_persona_supervisor)
        id, id_persona_supervisor, supervisor_nombre, fuente, fecha_contacto,
        medio_contacto, resultado, cantidad_afiliadores, proxima_accion,
        fecha_proximo_seguimiento, registrado_por
    FROM seguimiento_contacto_supervisor
    WHERE (:fuente IS NULL OR fuente = :fuente)
    ORDER BY id_persona_supervisor, fecha_contacto DESC
    """
)


def ultimos_contactos(db: Session, fuente: str | None = None) -> list[dict]:
    """El último contacto de CADA supervisor, en una sola consulta.

    Sin filtro por lista de ids a propósito: la tabla crece con la cantidad de contactos
    hechos a mano (decenas, no millones) y la pestaña agrupada necesita el mapa completo
    para pintar "cuándo se le habló" a cualquiera de los grupos visibles. Es más barato
    traerla entera una vez que armar el `= ANY(...)` desde el frontend.

    `fuente` acota a un indicador: "le escribí por su gente de Turnos" no responde
    "¿ya le hablé de los inactivos?", y la pestaña muestra un indicador a la vez.
    """
    return [dict(f) for f in db.execute(_ULTIMO_CONTACTO_SQL, {"fuente": fuente}).mappings().all()]
