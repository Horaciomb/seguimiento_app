/**
 * Arma el link de wa.me para abrir el chat directo con el afiliador, con un saludo
 * inicial precargado (editable antes de enviar) — simple a propósito, la conversación
 * real la lleva la persona que llama. Números en `empleado_unidad.telefono` son locales
 * bolivianos (8 dígitos, sin código de país) — hay que anteponer 591 para que wa.me
 * resuelva al número correcto.
 */
export function armarLinkWhatsapp(telefono, nombreCompleto) {
  if (!telefono) return null
  const soloDigitos = String(telefono).replace(/\D/g, '')
  if (!soloDigitos) return null
  const conCodigoPais = soloDigitos.startsWith('591') ? soloDigitos : `591${soloDigitos}`

  const primerNombre = nombreCompleto?.split(' ')[0] ?? ''
  const mensaje = primerNombre ? `Hola, ${primerNombre}` : 'Hola'

  return `https://wa.me/${conCodigoPais}?text=${encodeURIComponent(mensaje)}`
}

// Topes del mensaje al supervisor. Se corta por las DOS condiciones porque cada una
// falla sola: 12 nombres cortos entran bien, 12 nombres con métrica larga no. La URL de
// wa.me viaja por la barra de direcciones y por el intent de Android, que empiezan a
// fallar alrededor de los 2 KB; encodeURIComponent infla mucho (cada salto de línea es
// `%0A`, cada acento 6 caracteres), así que el límite se mide sobre el texto YA encodeado.
//
// En Turnos el corte se va a notar: ~700 filas sobre ~40 supervisores son ~17 por cabeza.
// Por eso la pestaña tiene filtros propios (por turno, por unidad) — el mensaje corto y
// accionable sale de filtrar, no de mandar la lista entera.
const MAX_AFILIADORES_EN_MENSAJE = 12
const MAX_LARGO_ENCODEADO = 1200

/**
 * Link de wa.me para escribirle al SUPERVISOR por su gente en alerta.
 *
 * Distinto del mensaje al afiliador (`armarLinkWhatsapp`, un saludo corto a propósito):
 * acá el mensaje sí lleva contenido, porque el supervisor necesita saber de quiénes se le
 * está hablando antes de poder hacer algo. Igual queda editable antes de enviar.
 *
 * `afiliadores`: [{ nombre, detalle }] — el `detalle` lo arma el caller, porque la métrica
 * que importa cambia con el indicador (días sin afiliar, cantidad del turno, veces en
 * alerta, producción del mes).
 */
export function armarLinkWhatsappSupervisor(telefono, nombreSupervisor, etiquetaFuente, afiliadores = []) {
  if (!telefono) return null
  const soloDigitos = String(telefono).replace(/\D/g, '')
  if (!soloDigitos) return null
  const conCodigoPais = soloDigitos.startsWith('591') ? soloDigitos : `591${soloDigitos}`

  const primerNombre = nombreSupervisor?.split(' ')[0] ?? ''
  const saludo = primerNombre ? `Hola, ${primerNombre}` : 'Hola'

  const lineas = []
  let largo = 0
  for (const a of afiliadores) {
    if (lineas.length >= MAX_AFILIADORES_EN_MENSAJE) break
    const linea = `• ${a.nombre}${a.detalle ? ` — ${a.detalle}` : ''}`
    largo += encodeURIComponent(`${linea}
`).length
    if (largo > MAX_LARGO_ENCODEADO) break
    lineas.push(linea)
  }
  const restantes = afiliadores.length - lineas.length
  if (restantes > 0) lineas.push(`• …y ${restantes} más`)

  const mensaje = [
    `${saludo}. Te comparto los afiliadores de tu equipo que están en alerta de ${etiquetaFuente}:`,
    '',
    lineas.join('\n'),
    '',
    '¿Podés hacer seguimiento con ellos y contarnos qué está pasando?',
  ].join('\n')

  return `https://wa.me/${conCodigoPais}?text=${encodeURIComponent(mensaje)}`
}
