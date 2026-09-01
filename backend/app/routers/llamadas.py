from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import LlamadaIn, LlamadaOut
from ..services import disponibilidad_service, llamadas_service

router = APIRouter(prefix="/llamadas", tags=["llamadas"])


@router.post("", response_model=LlamadaOut)
def registrar_llamada(datos: LlamadaIn, db: Session = Depends(get_db)):
    """Registra el contacto y, si se confirmó, actualiza la disponibilidad de la persona.

    `disponibilidad` no es una columna de `seguimiento_llamada`: es un atributo de la
    persona (`seguimiento_disponibilidad`, una fila por empleado) que se averigua en la
    conversación. Por eso llega en el mismo formulario pero se guarda aparte, en el mismo
    commit que la llamada — o se guardan las dos cosas, o ninguna.
    """
    payload = datos.model_dump()
    disponibilidad = payload.pop("disponibilidad", None)
    if disponibilidad:
        disponibilidad_service.guardar_disponibilidad(
            db, payload["id_empleado"], disponibilidad, payload.get("registrado_por")
        )
    llamada = llamadas_service.crear_llamada(db, payload)
    return llamada


@router.get("/historial/{id_empleado}", response_model=list[LlamadaOut])
def historial(id_empleado: int, db: Session = Depends(get_db)):
    return llamadas_service.historial_por_empleado(db, id_empleado)
