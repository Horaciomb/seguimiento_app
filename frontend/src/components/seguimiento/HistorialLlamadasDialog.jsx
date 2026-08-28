import { useQuery } from '@tanstack/react-query'
import { History, MessageCircle, PhoneCall } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { getHistorial } from '@/api/llamadas'
import { fmtFechaHora } from '@/lib/format'

const MOTIVO_LABEL = {
  SALUD: 'Salud',
  PERSONAL_FAMILIAR: 'Personal/familiar',
  OTRO_TRABAJO: 'Consiguió otro trabajo',
  NO_LE_GUSTA_TURNO: 'No le gusta el turno/proyecto',
  PAGO_COMISIONES: 'Pago/comisiones',
  DIFICULTAD_SISTEMA: 'Dificultad con el sistema',
  SIN_MOTIVO_CLARO: 'Sin motivo claro',
  OTRO: 'Otro',
}

const MEDIO_ICON = { WHATSAPP: MessageCircle, LLAMADA: PhoneCall }

const RESULTADO_LABEL = {
  CONTESTO: 'Contestó',
  NO_CONTESTO: 'No contestó',
  NUMERO_INCORRECTO: 'Número incorrecto',
  COMPROMISO: 'Compromiso de mejora',
  RESUELTO: 'Resuelto',
  ESCALADO: 'Escalado',
  OTRO: 'Otro',
}

const RESULTADO_VARIANT = {
  CONTESTO: 'default',
  RESUELTO: 'default',
  NO_CONTESTO: 'amber',
  NUMERO_INCORRECTO: 'rose',
  ESCALADO: 'rose',
  COMPROMISO: 'amber',
  OTRO: 'secondary',
}

const FUENTE_LABEL = {
  INACTIVIDAD: 'Inactividad',
  TURNOS: 'Turnos',
  REINCIDENCIA: 'Reincidencia',
  PRODUCCION_MTD: 'Producción MTD',
}

export default function HistorialLlamadasDialog({ empleado, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['llamadas', 'historial', empleado?.id_empleado],
    queryFn: () => getHistorial(empleado.id_empleado).then((r) => r.data),
    enabled: !!empleado,
  })

  if (!empleado) return null

  return (
    <Dialog open={!!empleado} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <History className="h-5 w-5 shrink-0 text-muted-foreground" />
            Historial de llamadas
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{empleado.nombre_completo}</p>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Cargando…</p>
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground py-4">Todavía no se registró ninguna llamada.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto py-1">
            {data.map((l) => {
              const IconoMedio = MEDIO_ICON[l.medio_contacto]
              return (
                <div key={l.id} className="border rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {IconoMedio && <IconoMedio className="h-3.5 w-3.5 text-muted-foreground" />}
                      <Badge variant={RESULTADO_VARIANT[l.resultado] ?? 'secondary'}>
                        {RESULTADO_LABEL[l.resultado] ?? l.resultado}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtFechaHora(l.fecha_contacto)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {FUENTE_LABEL[l.fuente] ?? l.fuente}
                    {l.registrado_por ? ` · registró: ${l.registrado_por}` : ''}
                  </p>
                  {l.motivo_bajo_rendimiento && (
                    <p className="text-sm"><span className="font-medium">Motivo:</span> {MOTIVO_LABEL[l.motivo_bajo_rendimiento] ?? l.motivo_bajo_rendimiento}</p>
                  )}
                  {l.proxima_accion && (
                    <p className="text-sm"><span className="font-medium">Próxima acción:</span> {l.proxima_accion}</p>
                  )}
                  {l.fecha_proximo_seguimiento && (
                    <p className="text-sm"><span className="font-medium">Próximo seguimiento:</span> {l.fecha_proximo_seguimiento}</p>
                  )}
                  {l.notas && <p className="text-sm text-muted-foreground">{l.notas}</p>}
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
