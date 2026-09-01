/**
 * Disponibilidad horaria de la persona (tiempo completo / medio tiempo / turno mañana o
 * tarde). El backend manda `disponibilidad` (código), `disponibilidad_label` (ya listo
 * para mostrar y filtrar) y `disponibilidad_origen`:
 *
 *   REGISTRADA     -> lo confirmó quien la contactó desde esta app (pisa a lo heredado)
 *   RECLUTAMIENTO  -> heredado del formulario de reclutamiento de Lab 001 (sólo cubre a
 *                     quien entró por ahí, ~20% de los afiliadores en alerta)
 *   null           -> no hay dato en ningún lado: hay que preguntárselo
 */
export const DISPONIBILIDADES = [
  { value: 'TIEMPO_COMPLETO', label: 'Tiempo completo' },
  { value: 'MEDIO_TIEMPO', label: 'Medio tiempo' },
  { value: 'TURNO_MANANA', label: 'Turno mañana' },
  { value: 'TURNO_TARDE', label: 'Turno tarde' },
  { value: 'NO_DEFINIDO', label: 'No definido' },
]

export const ORIGEN_LABEL = {
  REGISTRADA: 'confirmado',
  RECLUTAMIENTO: 'de reclutamiento',
}

export const DISPONIBILIDAD_VARIANT = {
  TIEMPO_COMPLETO: 'default',
  MEDIO_TIEMPO: 'amber',
  TURNO_MANANA: 'secondary',
  TURNO_TARDE: 'secondary',
  NO_DEFINIDO: 'outline',
}
