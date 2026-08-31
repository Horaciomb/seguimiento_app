import { MessageCircle, ClipboardCheck, History, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { fmtFechaHora } from '@/lib/format'
import { armarLinkWhatsapp } from '@/lib/whatsapp'

const RESULTADO_LABEL = {
  CONTESTO: 'Contestó',
  NO_CONTESTO: 'No contestó',
  NUMERO_INCORRECTO: 'Núm. incorrecto',
  COMPROMISO: 'Compromiso',
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

const MOTIVO_LABEL = {
  SALUD: 'Salud',
  PERSONAL_FAMILIAR: 'Personal/familiar',
  OTRO_TRABAJO: 'Otro trabajo',
  NO_LE_GUSTA_TURNO: 'No le gusta el turno',
  PAGO_COMISIONES: 'Pago/comisiones',
  DIFICULTAD_SISTEMA: 'Dificultad con el sistema',
  SIN_MOTIVO_CLARO: 'Sin motivo claro',
  OTRO: 'Otro',
}

function CeldaUltimoContacto({ ultima }) {
  if (!ultima) return <span className="text-xs text-muted-foreground">Nunca</span>
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 flex-wrap">
        <Badge variant={RESULTADO_VARIANT[ultima.resultado] ?? 'secondary'}>
          {RESULTADO_LABEL[ultima.resultado] ?? ultima.resultado}
        </Badge>
        {ultima.medio_contacto === 'WHATSAPP' && (
          <MessageCircle className="h-3 w-3 text-green-600 shrink-0" />
        )}
      </div>
      {ultima.motivo_bajo_rendimiento && (
        <div className="text-[11px] text-foreground/80">{MOTIVO_LABEL[ultima.motivo_bajo_rendimiento] ?? ultima.motivo_bajo_rendimiento}</div>
      )}
      <div className="text-[11px] text-muted-foreground">{fmtFechaHora(ultima.fecha_contacto)}</div>
    </div>
  )
}

/**
 * Tabla genérica para las 4 pantallas de alerta (mismo patrón que ProcesoTable/VetadosPage
 * de rrhh-app: columnas propias por caller + acciones comunes al final).
 *
 * `columns`: [{ header, cell(row) }]. Persona (nombre/CI/teléfono/supervisor/geografía) y
 * las acciones son siempre las mismas — sólo cambian las columnas de métrica de cada fuente.
 *
 * Dos acciones separadas a propósito: el botón de WhatsApp solo ABRE el chat (no registra
 * nada, es el medio más rápido para iniciar el contacto); "Registrar" es lo que deja
 * constancia de qué pasó y por qué — no se acoplan porque la respuesta de la persona llega
 * después de la conversación, no en el momento de abrir el chat.
 */
export default function TablaAlertas({ columns, items, onRegistrarLlamada, onVerHistorial, colSpanVacio, sort, onSortChange }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Supervisor</TableHead>
            <TableHead>Proyecto</TableHead>
            {columns.map((c) => (
              <TableHead key={c.header}>
                {c.sortKey ? (
                  <button
                    type="button"
                    onClick={() => onSortChange?.(c.sortKey)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {c.header}
                    {sort?.key === c.sortKey && (
                      sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                ) : (
                  c.header
                )}
              </TableHead>
            ))}
            <TableHead>Último contacto</TableHead>
            <TableHead className="w-44" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={colSpanVacio ?? columns.length + 6} className="text-center text-muted-foreground py-8">
                No hay nadie en esta lista ahora mismo.
              </TableCell>
            </TableRow>
          )}
          {items.map((row) => {
            const linkWhatsapp = armarLinkWhatsapp(row.telefono, row.nombre_completo)
            return (
              <TableRow key={row.id_empleado}>
                <TableCell>
                  <div className="font-medium">{row.nombre_completo}</div>
                  <div className="text-xs text-muted-foreground font-mono">{row.ci}</div>
                </TableCell>
                <TableCell className="text-sm">{row.telefono ?? '—'}</TableCell>
                <TableCell className="text-sm">{row.supervisor ?? '(sin asignar)'}</TableCell>
                <TableCell className="text-sm">
                  {row.unidad_negocio}
                  {row.campana && row.campana !== row.unidad_negocio ? ` / ${row.campana}` : ''}
                </TableCell>
                {columns.map((c) => (
                  <TableCell key={c.header}>{c.cell(row)}</TableCell>
                ))}
                <TableCell>
                  <CeldaUltimoContacto ultima={row.ultima_llamada} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      title={linkWhatsapp ? 'Escribir por WhatsApp' : 'Sin teléfono'}
                      disabled={!linkWhatsapp}
                      render={<a href={linkWhatsapp ?? undefined} target="_blank" rel="noopener noreferrer" />}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onRegistrarLlamada(row)}>
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      Registrar
                    </Button>
                    <Button size="icon-sm" variant="ghost" title="Historial" onClick={() => onVerHistorial(row)}>
                      <History className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
