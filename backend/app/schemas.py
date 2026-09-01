from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict


Disponibilidad = Literal[
    "TIEMPO_COMPLETO", "MEDIO_TIEMPO", "TURNO_MANANA", "TURNO_TARDE", "NO_DEFINIDO",
]


class UltimaLlamadaOut(BaseModel):
    """Resumen de la última llamada registrada, incrustado en cada fila de alerta."""

    id: int
    fecha_contacto: datetime
    resultado: str
    medio_contacto: str
    motivo_bajo_rendimiento: Optional[str] = None
    proxima_accion: Optional[str] = None
    fecha_proximo_seguimiento: Optional[date] = None
    registrado_por: Optional[str] = None


class _PersonaBase(BaseModel):
    id_empleado: int
    ci: Optional[str] = None
    nombre_completo: Optional[str] = None
    supervisor: Optional[str] = None
    ciudad: Optional[str] = None
    departamento: Optional[str] = None
    unidad_negocio: Optional[str] = None
    campana: Optional[str] = None
    telefono: Optional[str] = None
    # Disponibilidad horaria: código propio, etiqueta lista para mostrar/filtrar, y de
    # dónde salió (REGISTRADA por quien llamó · RECLUTAMIENTO heredado del formulario).
    disponibilidad: Optional[Disponibilidad] = None
    disponibilidad_label: str = "Sin dato"
    disponibilidad_origen: Optional[Literal["REGISTRADA", "RECLUTAMIENTO"]] = None
    disponibilidad_registrado_por: Optional[str] = None
    disponibilidad_actualizada: Optional[datetime] = None
    ultima_llamada: Optional[UltimaLlamadaOut] = None


class AlertaInactividadOut(_PersonaBase):
    fecha_ingreso: Optional[date] = None
    fecha_ultima_afiliacion: Optional[date] = None
    dias_inactividad: Optional[int] = None
    tramo: str
    estado_medicion: str
    horas_desde_el_calculo: Optional[float] = None


class AlertaTurnoOut(_PersonaBase):
    fecha: date
    turno: str
    cantidad: int
    operador: str
    umbral: int


class ReincidenciaOut(_PersonaBase):
    veces_en_alerta: int
    primera_fecha: date
    ultima_fecha: date


class AlertaProduccionMtdOut(_PersonaBase):
    produccion_actual_mtd: int
    promedio_historico_mtd: float
    variacion: float  # actual - promedio, en cantidad (siempre <= 0, ver contexto_indicadores.md §4.4)
    cumplimiento_pct: float  # produccion_actual_mtd / promedio_historico_mtd
    accion_sugerida: str


MotivoBajoRendimiento = Literal[
    "SALUD", "PERSONAL_FAMILIAR", "OTRO_TRABAJO", "NO_LE_GUSTA_TURNO",
    "PAGO_COMISIONES", "DIFICULTAD_SISTEMA", "SIN_MOTIVO_CLARO", "OTRO",
]


class LlamadaIn(BaseModel):
    id_empleado: int
    fuente: Literal["INACTIVIDAD", "TURNOS", "REINCIDENCIA", "PRODUCCION_MTD"]
    resultado: Literal[
        "CONTESTO", "NO_CONTESTO", "NUMERO_INCORRECTO", "COMPROMISO", "RESUELTO", "ESCALADO", "OTRO"
    ]
    medio_contacto: Literal["LLAMADA", "WHATSAPP", "OTRO"] = "LLAMADA"
    motivo_bajo_rendimiento: Optional[MotivoBajoRendimiento] = None
    # Opcional: si en el contacto se confirmó la disponibilidad de la persona, se guarda
    # (upsert) en seguimiento_disponibilidad además de registrar el contacto. Va acá y no
    # en un endpoint aparte porque el momento en que se averigua es justamente la llamada.
    disponibilidad: Optional[Disponibilidad] = None
    proxima_accion: Optional[str] = None
    fecha_proximo_seguimiento: Optional[date] = None
    notas: Optional[str] = None
    registrado_por: Optional[str] = None
    snapshot_metrica: Optional[dict[str, Any]] = None


class LlamadaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    id_empleado: int
    fuente: str
    fecha_contacto: datetime
    resultado: str
    medio_contacto: str
    motivo_bajo_rendimiento: Optional[str] = None
    proxima_accion: Optional[str] = None
    fecha_proximo_seguimiento: Optional[date] = None
    notas: Optional[str] = None
    registrado_por: Optional[str] = None
    snapshot_metrica: Optional[dict[str, Any]] = None
    created_at: datetime
