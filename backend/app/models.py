from sqlalchemy import BigInteger, DateTime, Date, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base

# Única tabla que esta app POSEE en rrhh_bd. Todo lo demás (empleado_unidad,
# vw_alerta_inactividad, vw_alerta_turnos, vw_produccion_mtd_vs_historico, etc.) es de
# Lab 001 y se lee con SQL crudo en services/alertas_service.py — declarar un modelo ORM
# para tablas que no son nuestras invitaría a "gestionarlas" desde acá por accidente.
#
# `id_empleado` NO lleva ForeignKey(...) acá a propósito: SQLAlchemy exige que la tabla
# referenciada esté en el mismo MetaData para resolverla en el flush (si no, revienta con
# NoReferencedTableError), y eso obligaría a declarar `empleado_unidad` como propia. El
# constraint real (REFERENCES empleado_unidad(id_empleado) ON DELETE CASCADE) sí existe en
# la base — lo crea la migración SQL — así que la integridad la sigue garantizando Postgres.

FUENTES_VALIDAS = ("INACTIVIDAD", "TURNOS", "REINCIDENCIA", "PRODUCCION_MTD")
RESULTADOS_VALIDOS = (
    "CONTESTO",
    "NO_CONTESTO",
    "NUMERO_INCORRECTO",
    "COMPROMISO",
    "RESUELTO",
    "ESCALADO",
    "OTRO",
)
MEDIOS_CONTACTO_VALIDOS = ("LLAMADA", "WHATSAPP", "OTRO")
# Motivo que da el afiliador para su bajo rendimiento — la información que la persona que
# llama/escribe existe para recopilar. Categorizado (con "OTRO" de escape) para poder
# reportar "cuántos se van por X motivo" sin leer notas de texto libre a mano.
MOTIVOS_BAJO_RENDIMIENTO_VALIDOS = (
    "SALUD",
    "PERSONAL_FAMILIAR",
    "OTRO_TRABAJO",
    "NO_LE_GUSTA_TURNO",
    "PAGO_COMISIONES",
    "DIFICULTAD_SISTEMA",
    "SIN_MOTIVO_CLARO",
    "OTRO",
)


class SeguimientoLlamada(Base):
    __tablename__ = "seguimiento_llamada"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    id_empleado: Mapped[int] = mapped_column(BigInteger, nullable=False)
    fuente: Mapped[str] = mapped_column(String(20), nullable=False)
    fecha_contacto: Mapped["object"] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    resultado: Mapped[str] = mapped_column(String(30), nullable=False)
    proxima_accion: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fecha_proximo_seguimiento: Mapped["object"] = mapped_column(Date, nullable=True)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    registrado_por: Mapped[str | None] = mapped_column(String(100), nullable=True)
    medio_contacto: Mapped[str] = mapped_column(String(20), nullable=False, server_default="LLAMADA")
    motivo_bajo_rendimiento: Mapped[str | None] = mapped_column(String(30), nullable=True)
    snapshot_metrica: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped["object"] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
