import { useState } from 'react'
import { descargarBlob, nombreDesdeContentDisposition } from '@/lib/download'

/**
 * Descarga un `.xlsx` de la API, con su estado de carga y el aviso de recorte.
 *
 * Copiado de `rrhh-app/frontend/src/hooks/useExportarXlsx.js`. Allá se extrajo al sumar el
 * segundo export, porque copiar la lógica habría dejado varios sitios donde olvidarse del
 * aviso de truncado — que es justamente la parte que no se puede perder.
 *
 * 🔴 **El recorte NO puede ser silencioso.** Un archivo topado se lee como el universo completo y
 * alguien decide sobre datos que no están. Por eso el backend manda `X-Filas-Exportadas` y
 * `X-Total-Disponible` en los tres exports, y esto los compara siempre.
 *
 * `pedir` recibe una función que hace la request (con `responseType: 'blob'`) y devuelve la
 * respuesta de axios.
 */
export default function useExportarXlsx({ nombrePorDefecto, etiqueta = 'registros' }) {
  const [exportando, setExportando] = useState(false)
  const [aviso, setAviso] = useState(null)

  const exportar = async (pedir) => {
    setExportando(true)
    setAviso(null)
    try {
      const r = await pedir()
      descargarBlob(r.data, nombreDesdeContentDisposition(r.headers, nombrePorDefecto))

      const exportadas = Number(r.headers['x-filas-exportadas'])
      const disponibles = Number(r.headers['x-total-disponible'])
      if (exportadas && disponibles && exportadas < disponibles) {
        setAviso(
          `Se exportaron ${exportadas} de ${disponibles} ${etiqueta}: el archivo está topado. ` +
          'Afiná los filtros para bajar el resto.',
        )
      }
    } catch {
      setAviso('No se pudo generar el archivo. Reintentá en unos segundos.')
    } finally {
      setExportando(false)
    }
  }

  return { exportar, exportando, aviso, limpiarAviso: () => setAviso(null) }
}
