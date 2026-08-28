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

/**
 * Hook genérico para las 4 pantallas de alerta (mismo patrón que useVetadosState.js de
 * rrhh-app): filtro de texto + paginación (client-side, las listas son de decenas/cientos
 * de filas) + useQuery de la fuente + mutación compartida para registrar una llamada.
 */
export function useAlertaListState({ queryKey, queryFn, filtrarTexto = TEXTO_DEFAULT }) {
  const [q, setQInterno] = useState('')
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
  const filtradas = qDebounced ? todas.filter((row) => filtrarTexto(row, qDebounced)) : todas
  const total = filtradas.length
  const items = filtradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const setQ = (value) => {
    setQInterno(value)
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
    page, setPage, pageSize: PAGE_SIZE,
    items, total,
    isLoading, isError, error, refetch,
    llamadaFila, setLlamadaFila,
    historialEmpleado, setHistorialEmpleado,
    llamadaMut,
  }
}
