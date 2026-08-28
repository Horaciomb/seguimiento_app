import { AlertTriangle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Estado de error de un listado — sin esto, un 500 se ve indistinguible de "no hay datos". */
export default function EstadoLista({ error, onReintentar, className = '' }) {
  const status = error?.response?.status

  const titulo = status ? `No se pudo cargar la lista (${status})` : 'No se pudo cargar la lista'
  const detalle = 'Puede ser una caída momentánea de la conexión o del servidor. Probá de nuevo.'

  return (
    <div
      role="alert"
      className={`flex flex-col items-center gap-3 py-12 px-6 text-center border rounded-lg border-dashed border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/10 ${className}`}
    >
      <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-500 shrink-0" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        <p className="text-xs text-muted-foreground max-w-sm">{detalle}</p>
      </div>
      {onReintentar && (
        <Button variant="outline" size="sm" onClick={onReintentar} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Reintentar
        </Button>
      )}
    </div>
  )
}
