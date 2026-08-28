from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import AlertaInactividadOut, AlertaProduccionMtdOut, AlertaTurnoOut, ReincidenciaOut
from ..services import alertas_service

router = APIRouter(prefix="/alertas", tags=["alertas"])


@router.get("/inactividad", response_model=list[AlertaInactividadOut])
def listar_inactividad(db: Session = Depends(get_db)):
    return alertas_service.get_inactividad(db)


@router.get("/turnos", response_model=list[AlertaTurnoOut])
def listar_turnos(db: Session = Depends(get_db)):
    return alertas_service.get_turnos(db)


@router.get("/reincidencia", response_model=list[ReincidenciaOut])
def listar_reincidencia(
    dias: int = Query(30, ge=1, le=365),
    minimo_veces: int = Query(3, ge=1),
    db: Session = Depends(get_db),
):
    return alertas_service.get_reincidencia(db, dias=dias, minimo_veces=minimo_veces)


@router.get("/produccion-mtd", response_model=list[AlertaProduccionMtdOut])
def listar_produccion_mtd(db: Session = Depends(get_db)):
    return alertas_service.get_produccion_mtd(db)
