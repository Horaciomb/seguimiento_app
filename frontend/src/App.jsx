import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import SeguimientoPage from '@/pages/SeguimientoPage'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SeguimientoPage />
    </QueryClientProvider>
  )
}
