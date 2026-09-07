import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { getActividad, getRegistradores } from '@/api/actividad'
import { hoyLocal } from '@/lib/format'

const PAGE_SIZE = 25

/** `yyyy-MM-dd` de hace N días, en hora local — para prellenar el `<input type="date">`. */
function haceDias(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Estado de la pantalla de Registro de actividad.
 *
 * ⚠️ NO reusa `useAlertaListState` a propósito: ese hook filtra, ordena y pagina EN EL
 * CLIENTE sobre un array completo (`filtradas.slice(...)`), y esta lista pagina en el
 * servidor. Doblarlo para soportar los dos modos lo volvería condicional en todos lados y
 * pondría en riesgo las 5 pestañas que hoy funcionan.
 *
 * Abre en los últimos 30 días: con el rango vacío la vista arranca trayendo todo, y eso
 * deja de leerse el día que la tabla tenga miles de filas.
 */
export function useActividadState() {
  const [desde, setDesdeInterno] = useState(() => haceDias(30))
  const [hasta, setHastaInterno] = useState(() => hoyLocal())
  const [registradoPor, setRegistradoPorInterno] = useState('')
  const [q, setQInterno] = useState('')
  const [page, setPage] = useState(1)
  const [detalle, setDetalle] = useState(null)

  const qDebounced = useDebounce(q, 300)

  const filtros = {
    desde: desde || undefined,
    hasta: hasta || undefined,
    registrado_por: registradoPor || undefined,
    q: qDebounced || undefined,
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['actividad', filtros, page],
    queryFn: () => getActividad({ ...filtros, pagina: page, por_pagina: PAGE_SIZE }).then((r) => r.data),
    // Sin esto la tabla se vacía y "salta" en cada cambio de página, porque cada página es
    // una queryKey distinta.
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })

  // Sin filtros: si respetara el rango, mover las fechas vaciaría el select y dejaría a
  // quien busca sin poder elegir a nadie. Es el mismo criterio que el endpoint.
  const { data: registradores = [] } = useQuery({
    queryKey: ['actividad', 'registradores'],
    queryFn: () => getRegistradores().then((r) => r.data),
    staleTime: 60_000,
  })

  // Todo cambio de filtro vuelve a la página 1: quedarse en la 4 de un resultado que ahora
  // tiene 2 páginas muestra una lista vacía que parece un error.
  const conReset = (setter) => (valor) => {
    setter(valor)
    setPage(1)
  }

  return {
    desde, setDesde: conReset(setDesdeInterno),
    hasta, setHasta: conReset(setHastaInterno),
    registradoPor, setRegistradoPor: conReset(setRegistradoPorInterno),
    q, setQ: conReset(setQInterno),
    page, setPage, pageSize: PAGE_SIZE,
    items: data?.items ?? [],
    total: data?.total ?? 0,
    registradores,
    isLoading, isError, error, refetch,
    detalle, setDetalle,
    filtros,
  }
}
