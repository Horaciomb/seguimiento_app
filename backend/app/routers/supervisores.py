from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import ContactoSupervisorIn, ContactoSupervisorOut, UltimoContactoSupervisorOut
from ..services import contactos_supervisor_service

router = APIRouter(prefix="/contactos-supervisor", tags=["supervisores"])


@router.post("", response_model=ContactoSupervisorOut)
def registrar_contacto(datos: ContactoSupervisorIn, db: Session = Depends(get_db)):
    """Registra el llamado de atención hecho al supervisor por su gente en alerta.

    Una fila por contacto, no por afiliador: `afiliadores` congela de quiénes se habló,
    con la métrica que motivó el mensaje. `cantidad_afiliadores` la deriva el servicio.
    """
    return contactos_supervisor_service.crear_contacto(db, datos.model_dump())


@router.get("/ultimos", response_model=list[UltimoContactoSupervisorOut])
def ultimos(fuente: Optional[str] = None, db: Session = Depends(get_db)):
    """El último contacto de cada supervisor, en una sola consulta.

    `fuente` opcional: la pestaña muestra un indicador a la vez y "ya le escribí por sus
    inactivos" no contesta "¿le escribí por su gente de turnos?".
    """
    return contactos_supervisor_service.ultimos_contactos(db, fuente)


@router.get("/historial/{id_persona_supervisor}", response_model=list[ContactoSupervisorOut])
def historial(id_persona_supervisor: int, db: Session = Depends(get_db)):
    return contactos_supervisor_service.historial_por_supervisor(db, id_persona_supervisor)
