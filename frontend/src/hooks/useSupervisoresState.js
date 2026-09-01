import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAlertaListState } from '@/hooks/useAlertaListState'
import { useDebounce } from '@/hooks/useDebounce'
import { getUltimosContactosSupervisor, postContactoSupervisor } from '@/api/supervisores'
import { agruparPorSupervisor } from '@/lib/supervisores'
import { getInactividad, getTurnos, getReincidencia, getProduccionMtd } from '@/api/alertas'

const PAGE_SIZE = 10

/** Los 4 indicadores, con el filtro que tiene sentido en cada uno visto por supervisor. */
export const FUENTES_SUPERVISOR = [
  {
    id: 'INACTIVIDAD',
    label: 'Inactividad',
    queryKey: ['alertas', 'inactividad'],
    queryFn: () => getInactividad().then((r) => r.data),
    camposFiltro: ['unidad_negocio', 'tramo', 'disponibilidad_label'],
    filtroCampos: [
      { campo: 'unidad_negocio', label: 'Unidad' },
      { campo: 'tramo', label: 'Tramo' },
      { campo: 'disponibilidad_label', label: 'Disponibilidad' },
    ],
  },
  {
    id: 'TURNOS',
    label: 'Turnos',
    queryKey: ['alertas', 'turnos'],
    queryFn: () => getTurnos().then((r) => r.data),
    camposFiltro: ['unidad_negocio', 'turno', 'disponibilidad_label'],
    filtroCampos: [
      { campo: 'unidad_negocio', label: 'Unidad' },
      { campo: 'turno', label: 'Turno' },
      { campo: 'disponibilidad_label', label: 'Disponibilidad' },
    ],
  },
  {
    id: 'REINCIDENCIA',
    label: 'Reincidencia',
    queryKey: ['alertas', 'reincidencia'],
    queryFn: () => getReincidencia().then((r) => r.data),
    camposFiltro: ['unidad_negocio', 'disponibilidad_label'],
    filtroCampos: [
      { campo: 'unidad_negocio', label: 'Unidad' },
      { campo: 'disponibilidad_label', label: 'Disponibilidad' },
    ],
  },
  {
    id: 'PRODUCCION_MTD',
    label: 'Producción MTD',
    queryKey: ['alertas', 'produccion-mtd'],
    queryFn: () => getProduccionMtd().then((r) => r.data),
    camposFiltro: ['unidad_negocio', 'accion_sugerida', 'disponibilidad_label'],
    filtroCampos: [
      { campo: 'unidad_negocio', label: 'Unidad' },
      { campo: 'accion_sugerida', label: 'Acción sugerida' },
      { campo: 'disponibilidad_label', label: 'Disponibilidad' },
    ],
  },
]

/**
 * Estado de la pestaña "Supervisores".
 *
 * Monta su PROPIA instancia de `useAlertaListState`, no reusa las 4 de las otras
 * pestañas: compartirlas haría que un filtro puesto en la pestaña de Turnos apareciera
 * aplicado acá sin que nadie lo tocara (es el mismo objeto de estado). No cuesta una
 * consulta extra — TanStack Query dedupea por `queryKey` y las 4 ya están en caché.
 *
 * Se agrupa sobre `filtradas` (la lista completa) y no sobre `items` (la página de 25):
 * agrupar la página daría equipos parciales.
 */
export function useSupervisoresState() {
  const [fuenteId, setFuenteIdInterno] = useState('INACTIVIDAD')
  const [qSupervisor, setQSupervisorInterno] = useState('')
  const [page, setPage] = useState(1)
  const [contactoGrupo, setContactoGrupo] = useState(null)
  const [historialSupervisor, setHistorialSupervisor] = useState(null)

  const fuente = FUENTES_SUPERVISOR.find((f) => f.id === fuenteId) ?? FUENTES_SUPERVISOR[0]
  const lista = useAlertaListState({
    queryKey: fuente.queryKey,
    queryFn: fuente.queryFn,
    camposFiltro: fuente.camposFiltro,
  })

  const qc = useQueryClient()
  const qDebounced = useDebounce(qSupervisor, 300)

  // Acotado a la fuente elegida: "ya le escribí por su gente de Turnos" no contesta
  // "¿le escribí por sus inactivos?".
  const { data: ultimos } = useQuery({
    queryKey: ['contactos-supervisor', 'ultimos', fuenteId],
    queryFn: () => getUltimosContactosSupervisor(fuenteId).then((r) => r.data),
    staleTime: 15_000,
  })
  const ultimoPorSupervisor = Object.fromEntries(
    (ultimos ?? []).map((c) => [c.id_persona_supervisor, c]),
  )

  const contactoMut = useMutation({
    mutationFn: postContactoSupervisor,
    onSuccess: () => {
      // Sólo los contactos: no cambió nada en las listas de alerta.
      qc.invalidateQueries({ queryKey: ['contactos-supervisor'] })
      setContactoGrupo(null)
    },
  })

  const todosLosGrupos = agruparPorSupervisor(lista.filtradas)
  const gruposFiltrados = qDebounced
    ? todosLosGrupos.filter((g) => g.nombre.toLowerCase().includes(qDebounced.toLowerCase()))
    : todosLosGrupos
  const grupos = gruposFiltrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const setFuenteId = (valor) => {
    setFuenteIdInterno(valor)
    setPage(1)
  }

  const setQSupervisor = (valor) => {
    setQSupervisorInterno(valor)
    setPage(1)
  }

  return {
    fuente, fuenteId, setFuenteId,
    lista,
    qSupervisor, setQSupervisor,
    grupos, totalGrupos: gruposFiltrados.length,
    page, setPage, pageSize: PAGE_SIZE,
    ultimoPorSupervisor,
    contactoGrupo, setContactoGrupo,
    historialSupervisor, setHistorialSupervisor,
    contactoMut,
  }
}
