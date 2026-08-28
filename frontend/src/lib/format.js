import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

/** Fecha corta para texto de lectura: `1-ene-26`. Mismo formato que rrhh-app (lib/format.js). */
export function fmtFechaCorta(f) {
  if (!f) return '—'
  try {
    return format(parseISO(String(f)), 'd-MMM-yy', { locale: es }).replace('.', '')
  } catch {
    return f ?? '—'
  }
}

/** Fecha con hora, para "última llamada": `28-ago-26 16:54`. */
export function fmtFechaHora(f) {
  if (!f) return '—'
  try {
    return format(parseISO(String(f)), "d-MMM-yy HH:mm", { locale: es }).replace('.', '')
  } catch {
    return f ?? '—'
  }
}

/** Tiempo relativo con sufijo (`hace 3 días`). */
export function fmtRelativo(f) {
  if (!f) return ''
  try {
    return formatDistanceToNow(parseISO(String(f)), { addSuffix: true, locale: es })
  } catch {
    return ''
  }
}

/** Fecha de hoy en local (`yyyy-MM-dd`), para prellenar `<input type="date">`. */
export function hoyLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
