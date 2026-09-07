import { AlertTriangle } from 'lucide-react'

/**
 * El aviso de que un `.xlsx` salió topado.
 *
 * 🔴 **El recorte no puede ser silencioso**: un archivo topado se lee como el universo completo y
 * alguien decide sobre datos que no están. El backend manda `X-Filas-Exportadas` y
 * `X-Total-Disponible` justamente para poder decirlo.
 *
 * Copiado de `rrhh-app/frontend/src/components/ui/aviso-export.jsx`, igual que el resto de
 * `components/ui/`.
 *
 * `mensaje` falsy ⇒ no renderiza nada, así que el llamador no necesita su propio condicional.
 */
export default function AvisoExport({ mensaje, onCerrar }) {
  if (!mensaje) return null
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-md border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-px" />
      <span className="flex-1">{mensaje}</span>
      {onCerrar && (
        <button onClick={onCerrar} className="text-muted-foreground hover:text-foreground">
          Cerrar
        </button>
      )}
    </div>
  )
}
