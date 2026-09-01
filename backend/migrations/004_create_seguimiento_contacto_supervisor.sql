-- seguimiento_app · 004_create_seguimiento_contacto_supervisor.sql
--
-- Pedido del usuario (2026-09-01): además de llamar al afiliador, hacerle el llamado de
-- atención al SUPERVISOR / líder a cargo por la gente de su equipo que no está saliendo.
-- La app pasa a poder agrupar la alerta por supervisor y escribirle con la lista de sus
-- afiliadores; esta tabla es el log de esos contactos.
--
-- Por qué una tabla aparte de `seguimiento_llamada` y no filas ahí:
--   - El sujeto del contacto es el supervisor, no el afiliador. Meter una fila por cada
--     afiliador mencionado inflaría el historial de cada persona con contactos que nunca
--     fueron a ella, y rompería la lectura de "cuándo se habló con Juan".
--   - Un contacto al supervisor habla de N afiliadores a la vez: es 1 fila con la lista,
--     no N filas iguales. `afiliadores` guarda a quiénes se refería.
--
-- Por qué `afiliadores` es JSONB y no un BIGINT[] de ids ni una tabla hija:
--   - Con sólo ids, dentro de una semana el historial no puede reconstruir el mensaje: la
--     métrica que lo motivaba ("45 días sin afiliar") ya no está en ninguna vista, porque
--     la alerta se recalcula todos los días. Se guarda el snapshot completo
--     [{"id_empleado":…, "nombre":…, "metrica":"45 días sin afiliar"}] — mismo criterio y
--     mismo tipo que `seguimiento_llamada.snapshot_metrica`, que existe por esta razón.
--   - Una tabla hija sumaría migración, modelo y join para un log de auditoría que nadie
--     consulta "por afiliador". Si algún día hace falta, un índice GIN es aditivo.
--
-- `id_persona_supervisor` va SIN FOREIGN KEY a propósito, a diferencia del
-- `REFERENCES empleado_unidad(...)` que sí llevan las migraciones 001 y 003. El motivo es
-- concreto: en Lab 001 esta es una referencia BLANDA declarada ("ref BLANDA a persona, sin
-- FK" en 07_generar_supervisores_pg.py y en su 01_create_tables.sql), y su propia
-- validación CUENTA los huérfanos como métrica esperada ("id_persona_supervisor huerfano
-- (sin persona)" en 06_validacion_final_pg.py). O sea: Lab 001 admite que existan. Con una
-- FK acá, registrar el contacto a un supervisor huérfano fallaría con un 500 justo en el
-- momento de usarlo. Hoy no hay ninguno (verificado en dev y prod el 2026-09-01), pero el
-- diseño del origen permite que aparezcan, y `supervisor_nombre` cubre la trazabilidad.
--
-- `supervisor_nombre` se guarda desnormalizado a propósito: es el nombre TAL COMO se vio
-- en la pantalla al momento del contacto (lo arman las vistas de Lab 001 con CONCAT_WS).
-- Si mañana cambia, el registro sigue diciendo a quién se le habló.
--
-- ⚠ Mismo caveat que las 3 migraciones anteriores: `clonar_a_dev.py` de Lab 001
-- reconstruye `rrhh_bd_dev` desde su propio inventario de tablas, donde esta no está —
-- un re-clon de dev la borra. Contra `rrhh_bd` (prod, nunca se re-clona) el riesgo es bajo.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS seguimiento_contacto_supervisor (
    id                        BIGSERIAL     PRIMARY KEY,
    id_persona_supervisor     BIGINT        NOT NULL,
    supervisor_nombre         VARCHAR(160),
    fuente                    VARCHAR(20)   NOT NULL,
    fecha_contacto            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    medio_contacto            VARCHAR(20)   NOT NULL DEFAULT 'WHATSAPP',
    resultado                 VARCHAR(30)   NOT NULL,
    -- De quiénes se habló y con qué número, congelados (ver el porqué del JSONB arriba).
    -- `cantidad_afiliadores` la calcula el backend con len(afiliadores), no la manda el
    -- cliente: es un dato derivado y no tiene sentido que puedan desincronizarse.
    cantidad_afiliadores      INTEGER       NOT NULL DEFAULT 0,
    afiliadores               JSONB         NOT NULL DEFAULT '[]'::jsonb,
    proxima_accion            VARCHAR(200),
    fecha_proximo_seguimiento DATE,
    notas                     TEXT,
    registrado_por            VARCHAR(100),
    created_at                TIMESTAMPTZ   NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_seguimiento_contacto_supervisor_fuente'
    ) THEN
        ALTER TABLE seguimiento_contacto_supervisor
            ADD CONSTRAINT ck_seguimiento_contacto_supervisor_fuente
            CHECK (fuente IN ('INACTIVIDAD','TURNOS','REINCIDENCIA','PRODUCCION_MTD'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_seguimiento_contacto_supervisor_medio'
    ) THEN
        ALTER TABLE seguimiento_contacto_supervisor
            ADD CONSTRAINT ck_seguimiento_contacto_supervisor_medio
            CHECK (medio_contacto IN ('LLAMADA','WHATSAPP','OTRO'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_seguimiento_contacto_supervisor_resultado'
    ) THEN
        ALTER TABLE seguimiento_contacto_supervisor
            ADD CONSTRAINT ck_seguimiento_contacto_supervisor_resultado
            -- Los mismos 7 valores que seguimiento_llamada, a propósito: es el mismo
            -- vocabulario de "qué pasó cuando lo contactaste" y así la UI comparte las
            -- etiquetas y los colores de badge (frontend/src/lib/contacto.js).
            CHECK (resultado IN ('CONTESTO','NO_CONTESTO','NUMERO_INCORRECTO','COMPROMISO','RESUELTO','ESCALADO','OTRO'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_seguimiento_contacto_supervisor_persona
    ON seguimiento_contacto_supervisor (id_persona_supervisor, fecha_contacto DESC);

GRANT SELECT, INSERT, UPDATE ON seguimiento_contacto_supervisor TO bex_app;
GRANT USAGE, SELECT ON SEQUENCE seguimiento_contacto_supervisor_id_seq TO bex_app;
