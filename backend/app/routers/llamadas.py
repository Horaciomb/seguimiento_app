from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import LlamadaIn, LlamadaOut
from ..services import llamadas_service

router = APIRouter(prefix="/llamadas", tags=["llamadas"])


@router.post("", response_model=LlamadaOut)
def registrar_llamada(datos: LlamadaIn, db: Session = Depends(get_db)):
    llamada = llamadas_service.crear_llamada(db, datos.model_dump())
    return llamada


@router.get("/historial/{id_empleado}", response_model=list[LlamadaOut])
def historial(id_empleado: int, db: Session = Depends(get_db)):
    return llamadas_service.historial_por_empleado(db, id_empleado)
