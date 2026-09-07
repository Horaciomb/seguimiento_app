/**
 * Disparar la descarga de un archivo que vino del backend como blob.
 *
 * Copiado de `rrhh-app/frontend/src/lib/download.js`, mismo criterio con el que se copió
 * todo `components/ui/`. Allá nació para el export de leads; acá lo usa el único export que
 * tiene esta app, el del Registro de actividad. Si algún día se retira esa exportación,
 * este archivo se va con ella — no dejarlo huérfano.
 *
 * El `URL.revokeObjectURL` no es opcional: cada `createObjectURL` reserva el blob en memoria
 * del navegador **hasta que se navega fuera de la página**. Sin revocar, exportar diez veces
 * seguidas deja diez copias del archivo retenidas en una SPA que nunca recarga.
 */
export function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  // Firefox exige que el <a> esté en el documento para que el click cuente.
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Saca el nombre de archivo del `Content-Disposition` que mandó el backend.
 *
 * Se prefiere el del servidor sobre uno armado en el cliente porque el sello de tiempo lo pone
 * el backend: si el nombre se armara acá, el reloj del navegador —que puede estar en otro huso
 * o mal puesto— decidiría cómo se llama el archivo, y dos exportaciones de la misma tanda
 * podrían quedar con horas distintas.
 */
export function nombreDesdeContentDisposition(headers, porDefecto) {
  const cd = headers?.['content-disposition'] || headers?.['Content-Disposition']
  const m = cd && /filename="?([^";]+)"?/i.exec(cd)
  return m ? m[1] : porDefecto
}
