import { MessageCircle, ClipboardCheck, History, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { fmtFechaHora } from '@/lib/format'
import { armarLinkWhatsapp } from '@/lib/whatsapp'
import { DISPONIBILIDAD_VARIANT, ORIGEN_LABEL } from '@/lib/disponibilidad'
import { RESULTADO_LABEL_CORTO, RESULTADO_VARIANT } from '@/lib/contacto'

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

// Disponibilidad horaria: a qué hora tiene sentido llamar a esta persona, y con qué
// expectativa de producción medirla. Se muestra en las 4 pestañas (es un dato de la
// persona, no de la métrica de cada fuente), con el origen abajo para distinguir lo que
// alguien confirmó por teléfono de lo que dijo al llenar el formulario de reclutamiento.
function CeldaDisponibilidad({ row }) {
  if (!row.disponibilidad) {
    return <span className="text-xs text-muted-foreground">Sin dato</span>
  }
  return (
    <div className="space-y-0.5">
      <Badge variant={DISPONIBILIDAD_VARIANT[row.disponibilidad] ?? 'secondary'}>
        {row.disponibilidad_label}
      </Badge>
      <div className="text-[11px] text-muted-foreground">
        {ORIGEN_LABEL[row.disponibilidad_origen] ?? ''}
      </div>
    </div>
  )
}

function CeldaUltimoContacto({ ultima }) {
  if (!ultima) return <span className="text-xs text-muted-foreground">Nunca</span>
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 flex-wrap">
        <Badge variant={RESULTADO_VARIANT[ultima.resultado] ?? 'secondary'}>
          {RESULTADO_LABEL_CORTO[ultima.resultado] ?? ultima.resultado}
        </Badge>
        {ultima.medio_contacto === 'WHATSAPP' && (
          <MessageCircle className="h-3 w-3 text-green-600 shrink-0" />
        )}
      </div>
      {ultima.motivo_bajo_rendimiento && (
        <div className="text-[11px] text-foreground/80">{MOTIVO_LABEL[ultima.motivo_bajo_rendimiento] ?? ultima.motivo_bajo_rendimiento}</div>
      )}
      <div className="text-[11px] text-muted-foreground tabular-nums">{fmtFechaHora(ultima.fecha_contacto)}</div>
    </div>
  )
}

/** Etiqueta + valor de un campo dentro de la tarjeta de teléfono. */
function Dato({ label, children, className }) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm tabular-nums">{children}</div>
    </div>
  )
}

/**
 * Los 3 botones de acción de una persona. En teléfono se renderizan a lo ancho, en una
 * segunda línea al pie de la tarjeta (`variante="tarjeta"`, altura táctil de 44px); en
 * escritorio, compactos dentro de la última columna de la tabla.
 */
function Acciones({ row, variante, onRegistrarLlamada, onVerHistorial }) {
  const linkWhatsapp = armarLinkWhatsapp(row.telefono, row.nombre_completo)
  const esTarjeta = variante === 'tarjeta'

  return (
    <div className={esTarjeta ? 'grid grid-cols-3 gap-2' : 'flex items-center gap-1'}>
      <Button
        size={esTarjeta ? 'touch' : 'icon-sm'}
        className={esTarjeta
          ? 'bg-green-600 hover:bg-green-700 text-white px-2 text-xs'
          : 'bg-green-600 hover:bg-green-700 text-white'}
        title={linkWhatsapp ? 'Escribir por WhatsApp' : 'Sin teléfono'}
        disabled={!linkWhatsapp}
        render={<a href={linkWhatsapp ?? undefined} target="_blank" rel="noopener noreferrer" />}
      >
        <MessageCircle className={esTarjeta ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        {esTarjeta && 'WhatsApp'}
      </Button>
      <Button
        size={esTarjeta ? 'touch' : 'sm'}
        variant="outline"
        className={esTarjeta ? 'px-2 text-xs' : 'h-8 gap-1'}
        onClick={() => onRegistrarLlamada(row)}
      >
        <ClipboardCheck className={esTarjeta ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        Registrar
      </Button>
      <Button
        size={esTarjeta ? 'touch' : 'icon-sm'}
        variant={esTarjeta ? 'outline' : 'ghost'}
        className={esTarjeta ? 'px-2 text-xs' : undefined}
        title="Historial"
        onClick={() => onVerHistorial(row)}
      >
        <History className={esTarjeta ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        {esTarjeta && 'Historial'}
      </Button>
    </div>
  )
}

/**
 * Barra de orden para teléfono: en la vista de tarjeta no hay encabezados de tabla donde
 * clickear, así que las columnas con `sortKey` se exponen acá (mismo ciclo asc → desc →
 * sin orden que el header de escritorio).
 */
function BarraOrden({ columns, sort, onSortChange }) {
  const ordenables = columns.filter((c) => c.sortKey)
  if (!ordenables.length) return null

  return (
    <div className="flex flex-wrap items-center gap-2 md:hidden">
      <span className="text-xs text-muted-foreground">Ordenar por:</span>
      {ordenables.map((c) => {
        const activo = sort?.key === c.sortKey
        const Icono = !activo ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
        return (
          <Button
            key={c.sortKey}
            size="touch"
            variant={activo ? 'secondary' : 'outline'}
            className="px-3 text-xs"
            onClick={() => onSortChange?.(c.sortKey)}
          >
            <Icono className="h-4 w-4" />
            {c.header}
          </Button>
        )
      })}
    </div>
  )
}

/**
 * Lista genérica para las 4 pantallas de alerta (mismo patrón que ProcesoTable/VetadosPage
 * de rrhh-app: columnas propias por caller + acciones comunes al final).
 *
 * `columns`: [{ header, cell(row), sortKey? }]. Persona (nombre/CI/teléfono/supervisor/
 * geografía) y las acciones son siempre las mismas — sólo cambian las columnas de métrica
 * de cada fuente.
 *
 * Dos vistas del mismo dato, elegidas por CSS y no por JS (así no parpadea en la primera
 * pintura ni depende de un `matchMedia`): tarjetas apiladas por persona en teléfono
 * (`md:hidden`) y la tabla de siempre en escritorio (`hidden md:block`). En teléfono cada
 * persona ocupa una tarjeta más alta, con los datos en dos columnas y los 3 botones en su
 * propia línea al pie — así no hay que desplazarse a la derecha para llegar a ellos
 * (pedido del usuario, 2026-09-01).
 *
 * Dos acciones separadas a propósito: el botón de WhatsApp solo ABRE el chat (no registra
 * nada, es el medio más rápido para iniciar el contacto); "Registrar" es lo que deja
 * constancia de qué pasó y por qué — no se acoplan porque la respuesta de la persona llega
 * después de la conversación, no en el momento de abrir el chat.
 */
export default function TablaAlertas({ columns, items, onRegistrarLlamada, onVerHistorial, colSpanVacio, sort, onSortChange }) {
  const vacio = items.length === 0

  return (
    <div className="space-y-2">
      <BarraOrden columns={columns} sort={sort} onSortChange={onSortChange} />

      {/* Teléfono: una tarjeta por persona */}
      <div className="space-y-2 md:hidden">
        {vacio && (
          <p className="border rounded-xl py-8 text-center text-sm text-muted-foreground">
            No hay nadie en esta lista ahora mismo.
          </p>
        )}
        {items.map((row) => (
          <div key={row.id_empleado} className="rounded-xl border bg-background p-3 space-y-3">
            <div>
              <div className="font-medium text-[15px] leading-tight text-pretty">{row.nombre_completo}</div>
              <div className="text-xs text-muted-foreground font-mono tabular-nums">{row.ci}</div>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <Dato label="Teléfono">{row.telefono ?? '—'}</Dato>
              <Dato label="Supervisor">{row.supervisor ?? '(sin asignar)'}</Dato>
              <Dato label="Proyecto" className="col-span-2">
                {row.unidad_negocio}
                {row.campana && row.campana !== row.unidad_negocio ? ` / ${row.campana}` : ''}
              </Dato>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Disponibilidad</div>
                <div className="mt-0.5"><CeldaDisponibilidad row={row} /></div>
              </div>
              {columns.map((c) => (
                <Dato key={c.header} label={c.header}>{c.cell(row)}</Dato>
              ))}
              <div className="col-span-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Último contacto</div>
                <div className="mt-0.5"><CeldaUltimoContacto ultima={row.ultima_llamada} /></div>
              </div>
            </div>

            <div className="border-t pt-3">
              <Acciones
                row={row}
                variante="tarjeta"
                onRegistrarLlamada={onRegistrarLlamada}
                onVerHistorial={onVerHistorial}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Escritorio: la tabla de siempre */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Supervisor</TableHead>
              <TableHead>Proyecto</TableHead>
            <TableHead>Disponibilidad</TableHead>
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
            {vacio && (
              <TableRow>
                <TableCell colSpan={colSpanVacio ?? columns.length + 7} className="text-center text-muted-foreground py-8">
                  No hay nadie en esta lista ahora mismo.
                </TableCell>
              </TableRow>
            )}
            {items.map((row) => (
              <TableRow key={row.id_empleado}>
                <TableCell>
                  <div className="font-medium">{row.nombre_completo}</div>
                  <div className="text-xs text-muted-foreground font-mono tabular-nums">{row.ci}</div>
                </TableCell>
                <TableCell className="text-sm tabular-nums">{row.telefono ?? '—'}</TableCell>
                <TableCell className="text-sm">{row.supervisor ?? '(sin asignar)'}</TableCell>
                <TableCell className="text-sm">
                  {row.unidad_negocio}
                  {row.campana && row.campana !== row.unidad_negocio ? ` / ${row.campana}` : ''}
                </TableCell>
                <TableCell>
                  <CeldaDisponibilidad row={row} />
                </TableCell>
                {columns.map((c) => (
                  <TableCell key={c.header} className="tabular-nums">{c.cell(row)}</TableCell>
                ))}
                <TableCell>
                  <CeldaUltimoContacto ultima={row.ultima_llamada} />
                </TableCell>
                <TableCell>
                  <Acciones
                    row={row}
                    variante="tabla"
                    onRegistrarLlamada={onRegistrarLlamada}
                    onVerHistorial={onVerHistorial}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
