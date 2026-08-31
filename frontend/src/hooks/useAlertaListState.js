import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { postLlamada } from '@/api/llamadas'

const PAGE_SIZE = 25

const TEXTO_DEFAULT = (row, q) => {
  const t = q.toLowerCase()
  return (
    row.nombre_completo?.toLowerCase().includes(t) ||
    row.ci?.toLowerCase().includes(t) ||
    row.telefono?.toLowerCase().includes(t) ||
    row.supervisor?.toLowerCase().includes(t)
  )
}

function compararValores(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Hook genérico para las 4 pantallas de alerta (mismo patrón que useVetadosState.js de
 * rrhh-app): filtro de texto + filtros por campo (select, `camposFiltro`) + orden por
 * columna + paginación (client-side, las listas son de decenas/cientos de filas) +
 * useQuery de la fuente + mutación compartida para registrar una llamada.
 */
export function useAlertaListState({ queryKey, queryFn, filtrarTexto = TEXTO_DEFAULT, camposFiltro = [] }) {
  const [q, setQInterno] = useState('')
  const [filtros, setFiltrosInterno] = useState({})
  const [sort, setSort] = useState(null) // { key, dir: 'asc' | 'desc' }
  const [page, setPage] = useState(1)
  const [llamadaFila, setLlamadaFila] = useState(null)
  const [historialEmpleado, setHistorialEmpleado] = useState(null)

  const qc = useQueryClient()
  const qDebounced = useDebounce(q, 300)

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn,
    staleTime: 15_000,
  })

  const todas = data ?? []

  // Opciones de cada filtro sobre el total sin filtrar, para que el desplegable no vaya
  // perdiendo opciones a medida que se aplican otros filtros.
  const opcionesFiltro = Object.fromEntries(
    camposFiltro.map((campo) => [campo, [...new Set(todas.map((r) => r[campo]).filter(Boolean))].sort()]),
  )

  const porTexto = qDebounced ? todas.filter((row) => filtrarTexto(row, qDebounced)) : todas
  const porFiltros = camposFiltro.reduce(
    (acc, campo) => (filtros[campo] ? acc.filter((row) => String(row[campo]) === filtros[campo]) : acc),
    porTexto,
  )
  const filtradas = sort
    ? [...porFiltros].sort((a, b) => compararValores(a[sort.key], b[sort.key]) * (sort.dir === 'asc' ? 1 : -1))
    : porFiltros

  const total = filtradas.length
  const items = filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const setQ = (value) => {
    setQInterno(value)
    setPage(1)
  }

  const setFiltro = (campo, valor) => {
    setFiltrosInterno((f) => ({ ...f, [campo]: valor }))
    setPage(1)
  }

  // Click 1: ascendente, click 2: descendente, click 3: sin orden (vuelve al orden de la fuente).
  const onSortChange = (key) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
    setPage(1)
  }

  const llamadaMut = useMutation({
    mutationFn: postLlamada,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      setLlamadaFila(null)
    },
  })

  return {
    q, setQ,
    filtros, setFiltro, opcionesFiltro,
    sort, onSortChange,
    page, setPage, pageSize: PAGE_SIZE,
    items, total,
    isLoading, isError, error, refetch,
    llamadaFila, setLlamadaFila,
    historialEmpleado, setHistorialEmpleado,
    llamadaMut,
  }
}
