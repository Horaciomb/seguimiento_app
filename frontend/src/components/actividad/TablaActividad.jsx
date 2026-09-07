import { MessageCircle, PhoneCall, Users, User, CalendarClock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { fmtFechaHora } from '@/lib/format'
import { RESULTADO_LABEL_CORTO, RESULTADO_VARIANT, FUENTE_LABEL } from '@/lib/contacto'

const TIPO = {
  AFILIADOR: { label: 'Afiliador', icono: User, variant: 'secondary' },
  SUPERVISOR: { label: 'Supervisor', icono: Users, variant: 'outline' },
  DISPONIBILIDAD: { label: 'Disponibilidad', icono: CalendarClock, variant: 'amber' },
}

const MEDIO_ICON = { WHATSAPP: MessageCircle, LLAMADA: PhoneCall }

/** La clave estable de una fila: `id_registro` NO es único entre tipos (el de
 *  DISPONIBILIDAD es un id_empleado, porque esa tabla no tiene id propio). */
export const claveFila = (f) => `${f.tipo}-${f.id_registro}`

function CeldaTipo({ fila }) {
  const t = TIPO[fila.tipo] ?? { label: fila.tipo, icono: User, variant: 'secondary' }
  const Icono = t.icono
  return (
    <Badge variant={t.variant}>
      <Icono />
      {t.label}
    </Badge>
  )
}

function CeldaResultado({ fila }) {
  if (!fila.resultado) return <span className="text-xs text-muted-foreground">—</span>
  const IconoMedio = MEDIO_ICON[fila.medio]
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant={RESULTADO_VARIANT[fila.resultado] ?? 'secondary'}>
        {RESULTADO_LABEL_CORTO[fila.resultado] ?? fila.resultado}
      </Badge>
      {IconoMedio && <IconoMedio className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
    </div>
  )
}

/**
 * Dos vistas del mismo dato elegidas por CSS y no por JS, igual que `TablaAlertas`: así no
 * parpadea en la primera pintura ni depende de `matchMedia`.
 */
export default function TablaActividad({ items, onVerDetalle }) {
  const vacio = items.length === 0
  const mensajeVacio = 'No hay registros en este período. Probá ampliando el rango de fechas.'

  return (
    <div className="space-y-2">
      {/* Teléfono: una tarjeta por registro */}
      <div className="space-y-2 md:hidden">
        {vacio && (
          <p className="border rounded-xl py-8 text-center text-sm text-muted-foreground">
            {mensajeVacio}
          </p>
        )}
        {items.map((f) => (
          <button
            key={claveFila(f)}
            type="button"
            onClick={() => onVerDetalle(f)}
            className="w-full text-left rounded-xl border bg-background p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <CeldaTipo fila={f} />
              <span className="text-xs text-muted-foreground tabular-nums">
                {fmtFechaHora(f.fecha)}
              </span>
            </div>
            <div>
              <div className="font-medium text-[15px] leading-tight text-pretty">
                {f.sujeto_nombre ?? '(sin nombre)'}
              </div>
              {f.sujeto_ci && (
                <div className="text-xs text-muted-foreground font-mono tabular-nums">{f.sujeto_ci}</div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <CeldaResultado fila={f} />
              <span className="text-xs text-muted-foreground">
                {f.indicador ? FUENTE_LABEL[f.indicador] ?? f.indicador : ''}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {f.registrado_por ? `Registró: ${f.registrado_por}` : 'Sin registrar quién'}
            </div>
          </button>
        ))}
      </div>

      {/* Escritorio: la tabla */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Persona / supervisor</TableHead>
              <TableHead>Indicador</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Quién registró</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {vacio && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {mensajeVacio}
                </TableCell>
              </TableRow>
            )}
            {items.map((f) => (
              <TableRow key={claveFila(f)}>
                <TableCell className="text-sm tabular-nums whitespace-nowrap">
                  {fmtFechaHora(f.fecha)}
                </TableCell>
                <TableCell><CeldaTipo fila={f} /></TableCell>
                <TableCell>
                  <div className="font-medium">{f.sujeto_nombre ?? '(sin nombre)'}</div>
                  {f.sujeto_ci && (
                    <div className="text-xs text-muted-foreground font-mono tabular-nums">{f.sujeto_ci}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {f.indicador ? FUENTE_LABEL[f.indicador] ?? f.indicador : '—'}
                </TableCell>
                <TableCell><CeldaResultado fila={f} /></TableCell>
                <TableCell className="text-sm">{f.registrado_por ?? '—'}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" className="h-8" onClick={() => onVerDetalle(f)}>
                    Detalle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
