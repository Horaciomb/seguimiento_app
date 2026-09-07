import { Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import AvisoExport from '@/components/ui/aviso-export'
import useExportarXlsx from '@/hooks/useExportarXlsx'
import { getActividadXlsx } from '@/api/actividad'
import SelectField from '@/components/ui/select-field'
import PaginationBar from '@/components/ui/pagination-bar'
import EstadoLista from '@/components/ui/estado-lista'
import TablaActividad from '@/components/actividad/TablaActividad'
import DetalleActividadDialog from '@/components/actividad/DetalleActividadDialog'
import { useActividadState } from '@/hooks/useActividadState'

// El Select no admite value="" como item, así que "todos" necesita un centinela — mismo
// recurso que ya usa SeguimientoPage.
const TODOS = '__todos__'

/**
 * Todo lo que esta app registró, en una sola línea de tiempo.
 *
 * Las 5 pestañas de Seguimiento muestran a quién HAY QUE contactar; esto muestra a quién SE
 * contactó, quién lo hizo y qué pasó. Antes de esta pantalla, la única forma de saberlo era
 * abrir el historial persona por persona.
 */
export default function ActividadPage() {
  const s = useActividadState()
  const xlsx = useExportarXlsx({ nombrePorDefecto: 'actividad.xlsx', etiqueta: 'registros' })

  const itemsRegistradores = [
    { value: TODOS, label: 'Quién registró: todos' },
    ...s.registradores.map((r) => ({
      value: r.registrado_por,
      label: `${r.registrado_por} (${r.cantidad})`,
    })),
  ]

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Registro de actividad</h2>
        <p className="text-sm text-muted-foreground">
          Contactos a afiliadores y a supervisores, y disponibilidades confirmadas, en orden
          cronológico.
        </p>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="desde" className="text-xs text-muted-foreground">Desde</Label>
            <Input id="desde" type="date" value={s.desde}
              onChange={(e) => s.setDesde(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hasta" className="text-xs text-muted-foreground">Hasta</Label>
            <Input id="hasta" type="date" value={s.hasta}
              onChange={(e) => s.setHasta(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Quién registró</Label>
            <SelectField
              value={s.registradoPor || TODOS}
              onValueChange={(v) => s.setRegistradoPor(v === TODOS ? '' : v)}
              items={itemsRegistradores}
              triggerClassName="w-full sm:w-56"
            />
          </div>
        </div>
        <Input
          value={s.q}
          onChange={(e) => s.setQ(e.target.value)}
          placeholder="Buscar por nombre o CI…"
          className="w-full sm:max-w-sm"
        />

        {/* Se le pasa `s.filtros` y NO la página: el archivo lleva el resultado del filtro,
            no los 25 que se están viendo. */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="touch"
            className="sm:h-9"
            disabled={xlsx.exportando || !s.total}
            onClick={() => xlsx.exportar(() => getActividadXlsx(s.filtros))}
          >
            <Download className="h-4 w-4" />
            {xlsx.exportando ? 'Generando…' : 'Exportar a Excel'}
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {s.total} registro{s.total === 1 ? '' : 's'}
          </span>
        </div>
        <AvisoExport mensaje={xlsx.aviso} onCerrar={xlsx.limpiarAviso} />
      </div>

      {s.isError ? (
        <EstadoLista error={s.error} onReintentar={s.refetch} />
      ) : s.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <TablaActividad items={s.items} onVerDetalle={s.setDetalle} />
          <PaginationBar page={s.page} pageSize={s.pageSize} total={s.total} onPageChange={s.setPage} />
        </>
      )}

      <DetalleActividadDialog fila={s.detalle} onClose={() => s.setDetalle(null)} />
    </div>
  )
}
