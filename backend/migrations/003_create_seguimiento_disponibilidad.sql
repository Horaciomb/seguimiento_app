-- seguimiento_app · 003_create_seguimiento_disponibilidad.sql
--
-- Pedido del usuario (2026-09-01): que desde la página se sepa la disponibilidad de cada
-- persona (tiempo completo · medio tiempo · turno mañana · turno tarde), para saber a qué
-- hora tiene sentido llamarla y con qué expectativa de producción medirla.
--
-- Por qué una tabla propia y no leer el dato de Lab 001:
--   - `empleado_unidad.disponibilidad_tiempo` existe pero está 100% NULL (verificado en
--     rrhh_bd_dev el 2026-09-01: 436 activos, 0 con dato).
--   - `proceso_reclutamiento.disponibilidad_tiempo` SÍ tiene dato (texto libre del
--     formulario de reclutamiento), pero sólo cubre a quien entró por ese formulario:
--     24 de los 119 afiliadores en alerta de Inactividad (~20%). El resto es personal
--     legado que nunca pasó por ahí.
-- Entonces: reclutamiento se usa como valor HEREDADO (mejor que nada) y esta tabla guarda
-- lo que confirma quien llama, que pisa al heredado. Mismo criterio que el resto de la
-- app: no se toca nada de Lab 001, sólo se agrega lectura/escritura propia encima.
--
-- Una fila por empleado (estado actual, no historial): la disponibilidad es un atributo
-- de la persona, no del contacto. El "cuándo y quién" queda en las columnas de auditoría;
-- el historial narrativo de cada contacto sigue viviendo en seguimiento_llamada.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS seguimiento_disponibilidad (
    id_empleado          BIGINT PRIMARY KEY
                         REFERENCES empleado_unidad(id_empleado) ON DELETE CASCADE,
    disponibilidad       VARCHAR(30) NOT NULL,
    registrado_por       VARCHAR(100),
    fecha_actualizacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_seguimiento_disponibilidad_valor'
    ) THEN
        ALTER TABLE seguimiento_disponibilidad
            ADD CONSTRAINT ck_seguimiento_disponibilidad_valor
            CHECK (disponibilidad IN (
                'TIEMPO_COMPLETO', 'MEDIO_TIEMPO', 'TURNO_MANANA', 'TURNO_TARDE', 'NO_DEFINIDO'
            ));
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON seguimiento_disponibilidad TO bex_app;
