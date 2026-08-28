/**
 * Arma el link de wa.me para abrir el chat directo con el afiliador, con un mensaje
 * inicial precargado (editable antes de enviar). Números en `empleado_unidad.telefono`
 * son locales bolivianos (8 dígitos, sin código de país) — hay que anteponer 591 para
 * que wa.me resuelva al número correcto.
 */
export function armarLinkWhatsapp(telefono, nombreCompleto) {
  if (!telefono) return null
  const soloDigitos = String(telefono).replace(/\D/g, '')
  if (!soloDigitos) return null
  const conCodigoPais = soloDigitos.startsWith('591') ? soloDigitos : `591${soloDigitos}`

  const primerNombre = nombreCompleto?.split(' ')[0] ?? ''
  const mensaje = `Hola ${primerNombre}, te escribimos de BEX Beneficios Latam porque notamos que tu actividad bajó últimamente. ¿Nos contás cómo estás y si podemos ayudarte en algo?`

  return `https://wa.me/${conCodigoPais}?text=${encodeURIComponent(mensaje)}`
}
