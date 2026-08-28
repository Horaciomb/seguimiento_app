import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** `true` por debajo del breakpoint `md` de Tailwind (768px). Mismo corte que rrhh-app. */
export function useIsMobile() {
  return useMediaQuery('(max-width: 767px)')
}
