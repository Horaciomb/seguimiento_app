-- seguimiento_app · 001_create_seguimiento_llamada.sql
--
-- Única tabla nueva que necesita seguimiento_app en rrhh_bd. Generaliza la idea de
-- alerta_inactividad_notificacion (dedup del indicador #1 del Lab 001) a un log de
-- contacto real para las tres fuentes de alerta (inactividad, turnos/reincidencia,
-- producción MTD): qué se llamó, qué contestó, qué sigue.
--
-- No toca ninguna tabla ni vista de Lab 001 — solo agrega esta tabla propia y sus GRANT.
-- Requiere el rol `bex_ingeniero` (dueño de las tablas); `bex_app` no puede hacer DDL.
--
-- Idempotente: se puede correr más de una vez sin efecto la segunda vez.
--
-- ⚠️ Nota de integración: el `clonar_a_dev.py` de Lab 001 reconstruye rrhh_bd_dev desde
-- SU PROPIO 01_create_tables.sql en cada re-clon. Esta tabla no está en ese inventario,
-- así que un re-clon de dev la borra — mismo modo de falla ya documentado varias veces
-- entre Lab 001 y rrhh-app (ver Lab 001 CLAUDE.md, sección FASE 9). Como esta app corre
-- contra rrhh_bd (prod, nunca se re-clona), el riesgo práctico es bajo; si algún día se
-- necesita que sobreviva un re-clon de dev, coordinar con Lab 001 para sumarla a su
-- inventario de tablas de la app (mismo tratamiento que `banco`/`TRABAJITO`).

CREATE TABLE IF NOT EXISTS seguimiento_llamada (
    id                        BIGSERIAL     PRIMARY KEY,
    id_empleado               BIGINT        NOT NULL REFERENCES empleado_unidad(id_empleado) ON DELETE CASCADE,
    fuente                    VARCHAR(20)   NOT NULL CHECK (fuente IN ('INACTIVIDAD','TURNOS','REINCIDENCIA','PRODUCCION_MTD')),
    fecha_contacto            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    resultado                 VARCHAR(30)   NOT NULL CHECK (resultado IN ('CONTESTO','NO_CONTESTO','NUMERO_INCORRECTO','COMPROMISO','RESUELTO','ESCALADO','OTRO')),
    proxima_accion            VARCHAR(200),
    fecha_proximo_seguimiento DATE,
    notas                     TEXT,
    registrado_por            VARCHAR(100),
    -- Snapshot de la métrica relevante al momento de la llamada (ej. dias_inactividad,
    -- turno+cantidad, variacion_pct) para que el registro conserve sentido aunque la
    -- alerta de origen ya haya cambiado quince minutos después.
    snapshot_metrica          JSONB,
    created_at                TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_seguimiento_llamada_empleado
    ON seguimiento_llamada (id_empleado, fecha_contacto DESC);

GRANT SELECT, INSERT, UPDATE ON seguimiento_llamada TO bex_app;
GRANT USAGE, SELECT ON SEQUENCE seguimiento_llamada_id_seq TO bex_app;
