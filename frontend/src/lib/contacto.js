/**
 * Vocabulario compartido de "qué pasó cuando lo contactaste".
 *
 * Estaba triplicado entre TablaAlertas.jsx, RegistrarLlamadaDialog.jsx y
 * HistorialLlamadasDialog.jsx; con los dos diálogos del contacto al supervisor habrían
 * sido cinco copias del mismo mapa. Los valores son los mismos para el afiliador y para
 * el supervisor a propósito (mismos CHECK en las dos tablas), así los badges se ven igual
 * en las dos pantallas.
 *
 * `MOTIVOS` NO está acá: el motivo del bajo rendimiento es del afiliador, no del
 * supervisor, y vive sólo en RegistrarLlamadaDialog.
 */

export const RESULTADO_LABEL = {
  CONTESTO: 'Contestó',
  NO_CONTESTO: 'No contestó',
  NUMERO_INCORRECTO: 'Número incorrecto',
  COMPROMISO: 'Compromiso de mejora',
  RESUELTO: 'Resuelto',
  ESCALADO: 'Escalado',
  OTRO: 'Otro',
}

export const RESULTADO_VARIANT = {
  CONTESTO: 'default',
  RESUELTO: 'default',
  NO_CONTESTO: 'amber',
  NUMERO_INCORRECTO: 'rose',
  ESCALADO: 'rose',
  COMPROMISO: 'amber',
  OTRO: 'secondary',
}

/**
 * Versión corta para la celda "Último contacto" de la tabla, donde el ancho es escaso.
 * Mismo conjunto de claves que RESULTADO_LABEL — si se agrega un resultado, va en las dos.
 */
export const RESULTADO_LABEL_CORTO = {
  ...RESULTADO_LABEL,
  NUMERO_INCORRECTO: 'Núm. incorrecto',
  COMPROMISO: 'Compromiso',
}

/** Items para el `SelectField` del formulario (mismo orden que el CHECK de la base). */
export const RESULTADOS = [
  { value: 'CONTESTO', label: 'Contestó' },
  { value: 'NO_CONTESTO', label: 'No contestó' },
  { value: 'NUMERO_INCORRECTO', label: 'Número incorrecto' },
  { value: 'COMPROMISO', label: 'Compromiso de mejora' },
  { value: 'RESUELTO', label: 'Resuelto' },
  { value: 'ESCALADO', label: 'Escalado / revisar con RRHH' },
  { value: 'OTRO', label: 'Otro' },
]

export const MEDIOS = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'LLAMADA', label: 'Llamada' },
  { value: 'OTRO', label: 'Otro' },
]

export const FUENTE_LABEL = {
  INACTIVIDAD: 'Inactividad',
  TURNOS: 'Turnos',
  REINCIDENCIA: 'Reincidencia',
  PRODUCCION_MTD: 'Producción MTD',
}
