import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import SelectField from '@/components/ui/select-field'
import PaginationBar from '@/components/ui/pagination-bar'
import EstadoLista from '@/components/ui/estado-lista'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import TablaAlertas from '@/components/seguimiento/TablaAlertas'
import RegistrarLlamadaDialog from '@/components/seguimiento/RegistrarLlamadaDialog'
import HistorialLlamadasDialog from '@/components/seguimiento/HistorialLlamadasDialog'
import { useAlertaListState } from '@/hooks/useAlertaListState'
import { getInactividad, getTurnos, getReincidencia, getProduccionMtd } from '@/api/alertas'
import { fmtFechaCorta } from '@/lib/format'

const TRAMO_VARIANT = {
  SEGUIMIENTO: 'amber',
  CRITICO: 'rose',
  'REVISAR BAJA': 'destructive',
}

// Sentinel para la opción "todos" de cada filtro — el Select no admite value="" como item.
const TODOS = '__todos__'

function Panel({ titulo, descripcion, fuente, estado, columns, filtroCampos }) {
  const { q, setQ, filtros, setFiltro, opcionesFiltro, sort, onSortChange,
    page, setPage, pageSize, items, total, isLoading, isError, error, refetch,
    llamadaFila, setLlamadaFila, historialEmpleado, setHistorialEmpleado, llamadaMut } = estado

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, CI, teléfono o supervisor…"
          className="max-w-sm"
        />
        {filtroCampos?.map(({ campo, label }) => (
          <SelectField
            key={campo}
            value={filtros[campo] || TODOS}
            onValueChange={(v) => setFiltro(campo, v === TODOS ? '' : v)}
            items={[
              { value: TODOS, label: `${label}: todos` },
              ...opcionesFiltro[campo].map((v) => ({ value: v, label: v })),
            ]}
            triggerClassName="w-48"
          />
        ))}
      </div>

      {isError ? (
        <EstadoLista error={error} onReintentar={refetch} />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <TablaAlertas
            columns={columns}
            items={items}
            onRegistrarLlamada={setLlamadaFila}
            onVerHistorial={setHistorialEmpleado}
            sort={sort}
            onSortChange={onSortChange}
          />
          <PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        </>
      )}

      <RegistrarLlamadaDialog
        fila={llamadaFila}
        fuente={fuente}
        onClose={() => setLlamadaFila(null)}
        mutation={llamadaMut}
      />
      <HistorialLlamadasDialog empleado={historialEmpleado} onClose={() => setHistorialEmpleado(null)} />
    </div>
  )
}

export default function SeguimientoPage() {
  const inactividad = useAlertaListState({
    queryKey: ['alertas', 'inactividad'],
    queryFn: () => getInactividad().then((r) => r.data),
    camposFiltro: ['unidad_negocio', 'supervisor', 'tramo'],
  })
  const turnos = useAlertaListState({
    queryKey: ['alertas', 'turnos'],
    queryFn: () => getTurnos().then((r) => r.data),
  })
  const reincidencia = useAlertaListState({
    queryKey: ['alertas', 'reincidencia'],
    queryFn: () => getReincidencia().then((r) => r.data),
  })
  const produccionMtd = useAlertaListState({
    queryKey: ['alertas', 'produccion-mtd'],
    queryFn: () => getProduccionMtd().then((r) => r.data),
  })

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Seguimiento de indicadores</h1>
      </div>

      <Tabs defaultValue="inactividad">
        <TabsList>
          <TabsTrigger value="inactividad">Inactividad ({inactividad.total || '…'})</TabsTrigger>
          <TabsTrigger value="turnos">Turnos ({turnos.total || '…'})</TabsTrigger>
          <TabsTrigger value="reincidencia">Reincidencia ({reincidencia.total || '…'})</TabsTrigger>
          <TabsTrigger value="produccion-mtd">Producción MTD ({produccionMtd.total || '…'})</TabsTrigger>
        </TabsList>

        <TabsContent value="inactividad" className="pt-3">
          <Panel
            titulo="Inactividad"
            descripcion="Afiliadores sin registrar una sola afiliación en varios días hábiles."
            fuente="INACTIVIDAD"
            estado={inactividad}
            filtroCampos={[
              { campo: 'unidad_negocio', label: 'Unidad' },
              { campo: 'supervisor', label: 'Supervisor' },
              { campo: 'tramo', label: 'Tramo' },
            ]}
            columns={[
              { header: 'Tramo', cell: (r) => <Badge variant={TRAMO_VARIANT[r.tramo] ?? 'secondary'}>{r.tramo}</Badge> },
              { header: 'Días inactivo', cell: (r) => r.dias_inactividad },
              { header: 'Última afiliación', sortKey: 'fecha_ultima_afiliacion', cell: (r) => fmtFechaCorta(r.fecha_ultima_afiliacion) },
            ]}
          />
        </TabsContent>

        <TabsContent value="turnos" className="pt-3">
          <Panel
            titulo="Turnos"
            descripcion="Carga fuera de horario en el último cálculo de NOCHE y MADRUGADA."
            fuente="TURNOS"
            estado={turnos}
            columns={[
              { header: 'Turno', cell: (r) => r.turno },
              { header: 'Cantidad', cell: (r) => r.cantidad },
              { header: 'Umbral', cell: (r) => `${r.operador} ${r.umbral}` },
              { header: 'Fecha', cell: (r) => fmtFechaCorta(r.fecha) },
            ]}
          />
        </TabsContent>

        <TabsContent value="reincidencia" className="pt-3">
          <Panel
            titulo="Reincidencia NOCHE/MADRUGADA"
            descripcion="Quiénes repitieron la alerta de turno 3 o más veces en los últimos 30 días."
            fuente="REINCIDENCIA"
            estado={reincidencia}
            columns={[
              { header: 'Veces en alerta', cell: (r) => r.veces_en_alerta },
              { header: 'Primera fecha', cell: (r) => fmtFechaCorta(r.primera_fecha) },
              { header: 'Última fecha', cell: (r) => fmtFechaCorta(r.ultima_fecha) },
            ]}
          />
        </TabsContent>

        <TabsContent value="produccion-mtd" className="pt-3">
          <Panel
            titulo="Producción MTD"
            descripcion="Producción del mes en curso por debajo de su propio promedio histórico."
            fuente="PRODUCCION_MTD"
            estado={produccionMtd}
            columns={[
              { header: 'Producción', cell: (r) => r.produccion_actual_mtd },
              { header: 'Esperado', cell: (r) => r.promedio_historico_mtd.toFixed(1) },
              { header: 'Cumplimiento', cell: (r) => `${Math.round(r.cumplimiento_pct * 100)}%` },
              { header: 'Acción sugerida', cell: (r) => r.accion_sugerida },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
