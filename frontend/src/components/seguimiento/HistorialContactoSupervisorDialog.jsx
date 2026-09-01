import { useQuery } from '@tanstack/react-query'
import { History, MessageCircle, PhoneCall } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { getHistorialSupervisor } from '@/api/supervisores'
import { fmtFechaHora } from '@/lib/format'
import { RESULTADO_LABEL, RESULTADO_VARIANT, FUENTE_LABEL } from '@/lib/contacto'

const MEDIO_ICON = { WHATSAPP: MessageCircle, LLAMADA: PhoneCall }

/**
 * Historial de los contactos hechos a UN supervisor, todas las fuentes.
 *
 * La lista de afiliadores de cada contacto va dentro de un `<details>` colapsado: es el
 * dato que hace útil el registro (de quiénes se le habló, con qué número) pero son 10-20
 * nombres por contacto y desplegados taparían la narrativa.
 */
export default function HistorialContactoSupervisorDialog({ grupo, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['contactos-supervisor', 'historial', grupo?.id_persona_supervisor],
    queryFn: () => getHistorialSupervisor(grupo.id_persona_supervisor).then((r) => r.data),
    enabled: !!grupo?.id_persona_supervisor,
  })

  if (!grupo) return null

  return (
    <Dialog open={!!grupo} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <History className="h-5 w-5 shrink-0 text-muted-foreground" />
            Contactos al supervisor
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{grupo.nombre}</p>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Cargando…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground py-4">
            Todavía no se le registró ningún contacto a este supervisor.
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto py-1">
            {data.map((c) => {
              const IconoMedio = MEDIO_ICON[c.medio_contacto]
              return (
                <div key={c.id} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {IconoMedio && <IconoMedio className="h-3.5 w-3.5 text-muted-foreground" />}
                      <Badge variant={RESULTADO_VARIANT[c.resultado] ?? 'secondary'}>
                        {RESULTADO_LABEL[c.resultado] ?? c.resultado}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{fmtFechaHora(c.fecha_contacto)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {FUENTE_LABEL[c.fuente] ?? c.fuente}
                    {c.registrado_por ? ` · registró: ${c.registrado_por}` : ''}
                  </p>
                  {c.proxima_accion && (
                    <p className="text-sm"><span className="font-medium">Próxima acción:</span> {c.proxima_accion}</p>
                  )}
                  {c.fecha_proximo_seguimiento && (
                    <p className="text-sm"><span className="font-medium">Próximo seguimiento:</span> {c.fecha_proximo_seguimiento}</p>
                  )}
                  {c.notas && <p className="text-sm text-muted-foreground">{c.notas}</p>}
                  {!!c.afiliadores?.length && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                        {c.cantidad_afiliadores} afiliadores mencionados
                      </summary>
                      <ul className="mt-1.5 space-y-0.5 border-l pl-3">
                        {c.afiliadores.map((a) => (
                          <li key={a.id_empleado} className="text-xs tabular-nums">
                            <span className="font-medium">{a.nombre}</span>
                            {a.metrica ? ` — ${a.metrica}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
