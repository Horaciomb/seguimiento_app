import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import SeguimientoPage from '@/pages/SeguimientoPage'
import ActividadPage from '@/pages/ActividadPage'

/**
 * Dos secciones, con estado local en vez de `react-router`.
 *
 * Es una app de una sola pantalla que se sirve bajo `/rrhh/seguimiento/`; sumar un router
 * obligaría a tocar el `base` de Vite y el fallback de Caddy, que hoy funcionan. El costo
 * aceptado es que no hay link directo a la sección — si algún día hace falta compartir uno,
 * ESE es el momento de traer el router, no antes.
 */
const SECCIONES = [
  { id: 'seguimiento', label: 'Seguimiento' },
  { id: 'actividad', label: 'Registro de actividad' },
]

export default function App() {
  const [seccion, setSeccion] = useState('seguimiento')

  return (
    <QueryClientProvider client={queryClient}>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <div className="space-y-3">
          <h1 className="text-2xl font-bold">Seguimiento de indicadores</h1>
          <div className="flex gap-2">
            {SECCIONES.map((s) => (
              <Button
                key={s.id}
                size="touch"
                variant={seccion === s.id ? 'default' : 'outline'}
                className="px-3 text-sm sm:h-9"
                onClick={() => setSeccion(s.id)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Las 5 pestañas se mantienen montadas: desmontarlas tiraría el filtro que quien
            trabaja tenía puesto cada vez que va a mirar el registro y vuelve. */}
        <div hidden={seccion !== 'seguimiento'}>
          <SeguimientoPage />
        </div>
        {seccion === 'actividad' && <ActividadPage />}
      </div>
    </QueryClientProvider>
  )
}
