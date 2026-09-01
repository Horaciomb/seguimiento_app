/**
 * Agrupación de las filas de alerta por el supervisor / líder a cargo.
 *
 * El nombre que muestran las vistas de Lab 001 y el teléfono que resuelve
 * `supervisores_service.py` salen de la MISMA fila de `persona` (las 3 vistas hacen
 * `LEFT JOIN persona sup ON sup.id_persona = eu.id_persona_supervisor`), así que la
 * etiqueta del grupo puede ser `row.supervisor` sin riesgo de escribirle a otro.
 *
 * Se agrupa por `id_persona_supervisor` y NO por el nombre: dos personas homónimas
 * colapsarían en un grupo y se le mandaría a una la gente de la otra.
 */

export const SIN_SUPERVISOR = '(sin asignar)'

/** Clave del grupo de quienes no tienen supervisor asignado. */
export const CLAVE_SIN_SUPERVISOR = '__sin_supervisor__'

export function agruparPorSupervisor(filas) {
  const grupos = new Map()
  for (const fila of filas) {
    const clave = fila.id_persona_supervisor ?? CLAVE_SIN_SUPERVISOR
    let grupo = grupos.get(clave)
    if (!grupo) {
      grupo = {
        clave,
        id_persona_supervisor: fila.id_persona_supervisor ?? null,
        // `row.supervisor` ya viene con '(sin asignar)' de la propia vista cuando no hay.
        nombre: fila.supervisor || SIN_SUPERVISOR,
        telefono: fila.supervisor_telefono ?? null,
        afiliadores: [],
      }
      grupos.set(clave, grupo)
    }
    grupo.afiliadores.push(fila)
  }

  return [...grupos.values()].sort((a, b) => {
    // El grupo sin supervisor va último: no es una lista de trabajo (no hay a quién
    // escribirle), es el pendiente de "asignarle un líder a esta gente en Lab 001".
    if (a.clave === CLAVE_SIN_SUPERVISOR) return 1
    if (b.clave === CLAVE_SIN_SUPERVISOR) return -1
    // Primero el que más gente en alerta tiene: es por dónde conviene empezar.
    return b.afiliadores.length - a.afiliadores.length || a.nombre.localeCompare(b.nombre)
  })
}

/**
 * La métrica del indicador, ya formateada, para la línea del afiliador en el mensaje de
 * WhatsApp y para el snapshot que se guarda con el contacto.
 *
 * Se congela como TEXTO a propósito: la alerta se recalcula todos los días, y dentro de
 * una semana "45 días sin afiliar" ya no está en ninguna vista para reconstruirlo.
 */
export function metricaDeFila(fila, fuente) {
  switch (fuente) {
    case 'INACTIVIDAD':
      return fila.dias_inactividad == null
        ? fila.tramo
        : `${fila.dias_inactividad} días sin afiliar (${fila.tramo})`
    case 'TURNOS':
      return `${fila.cantidad} en ${fila.turno} (umbral ${fila.operador} ${fila.umbral})`
    case 'REINCIDENCIA':
      return `${fila.veces_en_alerta} veces en alerta de turno`
    case 'PRODUCCION_MTD':
      return `${fila.produccion_actual_mtd} de ${Math.round(fila.promedio_historico_mtd)} esperadas este mes`
    default:
      return ''
  }
}
