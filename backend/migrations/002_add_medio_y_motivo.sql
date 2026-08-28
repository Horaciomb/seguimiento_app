-- seguimiento_app · 002_add_medio_y_motivo.sql
--
-- Pedido del usuario (2026-08-28): facilitar el contacto por WhatsApp y recopilar, en el
-- mismo registro, el motivo de bajo rendimiento que cuenta el afiliador. Dos columnas
-- nuevas sobre seguimiento_llamada:
--   - medio_contacto: por qué canal se lo contactó (antes se asumía siempre "llamada")
--   - motivo_bajo_rendimiento: categoría del motivo que dio la persona, para poder
--     reportar "cuántos se van por X motivo" sin leer notas de texto libre a mano
--
-- Idempotente.

ALTER TABLE seguimiento_llamada
    ADD COLUMN IF NOT EXISTS medio_contacto VARCHAR(20) NOT NULL DEFAULT 'LLAMADA',
    ADD COLUMN IF NOT EXISTS motivo_bajo_rendimiento VARCHAR(30);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_seguimiento_llamada_medio_contacto'
    ) THEN
        ALTER TABLE seguimiento_llamada
            ADD CONSTRAINT ck_seguimiento_llamada_medio_contacto
            CHECK (medio_contacto IN ('LLAMADA', 'WHATSAPP', 'OTRO'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_seguimiento_llamada_motivo'
    ) THEN
        ALTER TABLE seguimiento_llamada
            ADD CONSTRAINT ck_seguimiento_llamada_motivo
            CHECK (motivo_bajo_rendimiento IS NULL OR motivo_bajo_rendimiento IN (
                'SALUD', 'PERSONAL_FAMILIAR', 'OTRO_TRABAJO', 'NO_LE_GUSTA_TURNO',
                'PAGO_COMISIONES', 'DIFICULTAD_SISTEMA', 'SIN_MOTIVO_CLARO', 'OTRO'
            ));
    END IF;
END $$;
