import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import SelectField from '@/components/ui/select-field'
import PaginationBar from '@/components/ui/pagination-bar'
import EstadoLista from '@/components/ui/estado-lista'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import TablaAlertas from '@/components/seguimiento/TablaAlertas'
import RegistrarLlamadaDialog from '@/components/seguimiento/RegistrarLlamadaDialog'
import HistorialLlamadasDialog from '@/components/seguimiento/HistorialLlamadasDialog'
import TablaSupervisores from '@/components/seguimiento/TablaSupervisores'
import RegistrarContactoSupervisorDialog from '@/components/seguimiento/RegistrarContactoSupervisorDialog'
import HistorialContactoSupervisorDialog from '@/components/seguimiento/HistorialContactoSupervisorDialog'
import { useAlertaListState } from '@/hooks/useAlertaListState'
import { useSupervisoresState, FUENTES_SUPERVISOR } from '@/hooks/useSupervisoresState'
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

      {/* En teléfono los filtros van en dos columnas a lo ancho (un select por línea es
          demasiado alto); desde `sm` vuelven a la fila de siempre. */}
      <div className="space-y-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, CI, teléfono o supervisor…"
          className="w-full sm:max-w-sm"
        />
        {!!filtroCampos?.length && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {filtroCampos.map(({ campo, label }) => (
              <SelectField
                key={campo}
                value={filtros[campo] || TODOS}
                onValueChange={(v) => setFiltro(campo, v === TODOS ? '' : v)}
                items={[
                  { value: TODOS, label: `${label}: todos` },
                  ...opcionesFiltro[campo].map((v) => ({ value: v, label: v })),
                ]}
                triggerClassName="w-full sm:w-48"
              />
            ))}
          </div>
        )}
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

/**
 * La misma alerta, pero vista por líder a cargo: para hacerle el llamado de atención al
 * supervisor por la gente de su equipo que no está saliendo, en vez de perseguir uno por
 * uno a los afiliadores.
 *
 * Un indicador a la vez (el selector), porque el mensaje que se le manda lleva la lista
 * de esa alerta concreta. Los filtros son los del indicador elegido y son PROPIOS de esta
 * pestaña: sirven para acotar el mensaje ("tu gente de TARDE") sin tocar lo que se está
 * mirando en las otras 4.
 */
function PanelSupervisores() {
  const s = useSupervisoresState()
  const { lista } = s

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Supervisores</h2>
        <p className="text-sm text-muted-foreground">
          Cuánta gente de cada equipo está en alerta del indicador elegido. El contador y la lista
          cambian con el selector. Desplegá un supervisor para ver a los suyos.
        </p>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <SelectField
            value={s.fuenteId}
            onValueChange={s.setFuenteId}
            items={FUENTES_SUPERVISOR.map((f) => ({ value: f.id, label: `Indicador: ${f.label}` }))}
            triggerClassName="w-full sm:w-56"
          />
          {s.fuente.filtroCampos.map(({ campo, label }) => (
            <SelectField
              key={campo}
              value={lista.filtros[campo] || TODOS}
              onValueChange={(v) => lista.setFiltro(campo, v === TODOS ? '' : v)}
              items={[
                { value: TODOS, label: `${label}: todos` },
                ...lista.opcionesFiltro[campo].map((v) => ({ value: v, label: v })),
              ]}
              triggerClassName="w-full sm:w-48"
            />
          ))}
        </div>
        <Input
          value={s.qSupervisor}
          onChange={(e) => s.setQSupervisor(e.target.value)}
          placeholder="Buscar supervisor por nombre…"
          className="w-full sm:max-w-sm"
        />
      </div>

      {lista.isError ? (
        <EstadoLista isError error={lista.error} onRetry={lista.refetch} />
      ) : lista.isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
      ) : (
        <>
          <TablaSupervisores
            grupos={s.grupos}
            fuenteId={s.fuenteId}
            etiquetaFuente={s.fuente.label}
            ultimoPorSupervisor={s.ultimoPorSupervisor}
            onRegistrar={s.setContactoGrupo}
            onVerHistorial={s.setHistorialSupervisor}
          />
          <PaginationBar
            page={s.page}
            pageSize={s.pageSize}
            total={s.totalGrupos}
            onPageChange={s.setPage}
          />
        </>
      )}

      <RegistrarContactoSupervisorDialog
        grupo={s.contactoGrupo}
        fuenteId={s.fuenteId}
        etiquetaFuente={s.fuente.label}
        onClose={() => s.setContactoGrupo(null)}
        mutation={s.contactoMut}
      />
      <HistorialContactoSupervisorDialog
        grupo={s.historialSupervisor}
        onClose={() => s.setHistorialSupervisor(null)}
      />
    </div>
  )
}


export default function SeguimientoPage() {
  const inactividad = useAlertaListState({
    queryKey: ['alertas', 'inactividad'],
    queryFn: () => getInactividad().then((r) => r.data),
    camposFiltro: ['unidad_negocio', 'supervisor', 'tramo', 'disponibilidad_label'],
  })
  const turnos = useAlertaListState({
    queryKey: ['alertas', 'turnos'],
    queryFn: () => getTurnos().then((r) => r.data),
    camposFiltro: ['unidad_negocio', 'supervisor', 'turno', 'disponibilidad_label'],
  })
  const reincidencia = useAlertaListState({
    queryKey: ['alertas', 'reincidencia'],
    queryFn: () => getReincidencia().then((r) => r.data),
    camposFiltro: ['unidad_negocio', 'supervisor', 'disponibilidad_label'],
  })
  const produccionMtd = useAlertaListState({
    queryKey: ['alertas', 'produccion-mtd'],
    queryFn: () => getProduccionMtd().then((r) => r.data),
    camposFiltro: ['unidad_negocio', 'supervisor', 'accion_sugerida', 'disponibilidad_label'],
  })

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Seguimiento de indicadores</h1>
      </div>

      <Tabs defaultValue="inactividad">
        {/* Las 4 pestañas no entran en el ancho de un teléfono: se desplazan en horizontal,
            sangrando el padding de la página para que se vea que hay más a la derecha. */}
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="h-11 md:h-9">
            <TabsTrigger value="inactividad">Inactividad ({inactividad.total || '…'})</TabsTrigger>
            <TabsTrigger value="turnos">Turnos ({turnos.total || '…'})</TabsTrigger>
            <TabsTrigger value="reincidencia">Reincidencia ({reincidencia.total || '…'})</TabsTrigger>
            <TabsTrigger value="produccion-mtd">Producción MTD ({produccionMtd.total || '…'})</TabsTrigger>
            <TabsTrigger value="supervisores">Supervisores</TabsTrigger>
          </TabsList>
        </div>

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
              { campo: 'disponibilidad_label', label: 'Disponibilidad' },
            ]}
            columns={[
              { header: 'Tramo', cell: (r) => <Badge variant={TRAMO_VARIANT[r.tramo] ?? 'secondary'}>{r.tramo}</Badge> },
              { header: 'Días inactivo', cell: (r) => r.dias_inactividad },
              { header: 'Última afiliación', sortKey: 'fecha_ultima_afiliacion', cell: (r) => fmtFechaCorta(r.fecha_ultima_afiliacion) },
              {
                header: 'Foto calculada',
                cell: (r) => r.horas_desde_el_calculo == null
                  ? '—'
                  : `Hace ${Math.round(r.horas_desde_el_calculo)} h`,
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="turnos" className="pt-3">
          <Panel
            titulo="Turnos"
            descripcion="Último cálculo de cada turno en alerta: bajo rendimiento en MAÑANA/TARDE y carga fuera de horario en NOCHE/MADRUGADA. Filtrá por turno para separarlos."
            fuente="TURNOS"
            estado={turnos}
            filtroCampos={[
              { campo: 'unidad_negocio', label: 'Unidad' },
              { campo: 'supervisor', label: 'Supervisor' },
              { campo: 'turno', label: 'Turno' },
              { campo: 'disponibilidad_label', label: 'Disponibilidad' },
            ]}
            columns={[
              { header: 'Turno', cell: (r) => r.turno },
              { header: 'Cantidad', sortKey: 'cantidad', cell: (r) => r.cantidad },
              { header: 'Umbral', cell: (r) => `${r.operador} ${r.umbral}` },
              { header: 'Fecha', sortKey: 'fecha', cell: (r) => fmtFechaCorta(r.fecha) },
            ]}
          />
        </TabsContent>

        <TabsContent value="reincidencia" className="pt-3">
          <Panel
            titulo="Reincidencia NOCHE/MADRUGADA"
            descripcion="Quiénes repitieron la alerta de turno 3 o más veces en los últimos 30 días."
            fuente="REINCIDENCIA"
            estado={reincidencia}
            filtroCampos={[
              { campo: 'unidad_negocio', label: 'Unidad' },
              { campo: 'supervisor', label: 'Supervisor' },
              { campo: 'disponibilidad_label', label: 'Disponibilidad' },
            ]}
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
            filtroCampos={[
              { campo: 'unidad_negocio', label: 'Unidad' },
              { campo: 'supervisor', label: 'Supervisor' },
              { campo: 'accion_sugerida', label: 'Acción sugerida' },
              { campo: 'disponibilidad_label', label: 'Disponibilidad' },
            ]}
            columns={[
              { header: 'Producción', cell: (r) => r.produccion_actual_mtd },
              { header: 'Esperado', cell: (r) => r.promedio_historico_mtd.toFixed(1) },
              { header: 'Cumplimiento', cell: (r) => `${Math.round(r.cumplimiento_pct * 100)}%` },
              { header: 'Acción sugerida', cell: (r) => r.accion_sugerida },
            ]}
          />
        </TabsContent>

        <TabsContent value="supervisores" className="pt-3">
          <PanelSupervisores />
        </TabsContent>
      </Tabs>
    </div>
  )
}
