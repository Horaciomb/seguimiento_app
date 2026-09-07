import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { fmtFechaHora, fmtFechaCorta } from '@/lib/format'
import { RESULTADO_LABEL, RESULTADO_VARIANT, FUENTE_LABEL } from '@/lib/contacto'
import { DISPONIBILIDAD_LABEL } from '@/lib/disponibilidad'

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

const TITULO = {
  AFILIADOR: 'Contacto al afiliador',
  SUPERVISOR: 'Contacto al supervisor',
  DISPONIBILIDAD: 'Disponibilidad confirmada',
}

function Campo({ label, children }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <p className="text-sm">
      <span className="font-medium">{label}:</span> {children}
    </p>
  )
}

/**
 * El detalle completo de un registro de la línea de tiempo.
 *
 * La lista muestra sólo las columnas comunes a los 3 tipos; lo específico de cada uno vive
 * en `detalle` (un JSONB armado por `actividad_service`) y se despliega acá.
 */
export default function DetalleActividadDialog({ fila, onClose }) {
  if (!fila) return null
  const d = fila.detalle ?? {}
  const afiliadores = d.afiliadores ?? []

  return (
    <Dialog open={!!fila} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="text-lg font-bold">
            {TITULO[fila.tipo] ?? fila.tipo}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {fila.sujeto_nombre ?? '(sin nombre)'}
            {fila.sujeto_ci ? ` · CI ${fila.sujeto_ci}` : ''}
          </p>
        </DialogHeader>

        <div className="space-y-2 max-h-96 overflow-y-auto py-1">
          <div className="flex items-center justify-between gap-2">
            {fila.resultado ? (
              <Badge variant={RESULTADO_VARIANT[fila.resultado] ?? 'secondary'}>
                {RESULTADO_LABEL[fila.resultado] ?? fila.resultado}
              </Badge>
            ) : <span />}
            <span className="text-xs text-muted-foreground tabular-nums">
              {fmtFechaHora(fila.fecha)}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            {fila.indicador ? FUENTE_LABEL[fila.indicador] ?? fila.indicador : 'Sin indicador'}
            {fila.registrado_por ? ` · registró: ${fila.registrado_por}` : ''}
          </p>

          <Campo label="Medio">{fila.medio}</Campo>
          <Campo label="Motivo">{MOTIVO_LABEL[d.motivo_bajo_rendimiento] ?? d.motivo_bajo_rendimiento}</Campo>
          <Campo label="Disponibilidad">{DISPONIBILIDAD_LABEL[d.disponibilidad] ?? d.disponibilidad}</Campo>
          <Campo label="Próxima acción">{d.proxima_accion}</Campo>
          <Campo label="Próximo seguimiento">
            {d.fecha_proximo_seguimiento ? fmtFechaCorta(d.fecha_proximo_seguimiento) : null}
          </Campo>
          {d.notas && <p className="text-sm text-muted-foreground">{d.notas}</p>}

          {/* La lista congelada del contacto al supervisor. Sale del snapshot y no de la
              alerta de hoy: la métrica que motivó el mensaje ya no existe al día siguiente,
              porque la alerta se recalcula. */}
          {afiliadores.length > 0 && (
            <div className="border-t pt-2 space-y-1">
              <p className="text-sm font-medium">
                Se le habló de {afiliadores.length} persona{afiliadores.length === 1 ? '' : 's'}:
              </p>
              <ul className="space-y-0.5">
                {afiliadores.map((a) => (
                  <li key={a.id_empleado} className="text-sm text-muted-foreground">
                    {a.nombre ?? a.id_empleado}
                    {a.metrica ? ` — ${a.metrica}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
