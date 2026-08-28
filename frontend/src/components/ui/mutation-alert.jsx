import { AlertTriangle, XCircle } from 'lucide-react'

function isBusinessError(error) {
  const status = error?.response?.status
  return status && status >= 400 && status < 500
}

export default function MutationAlert({ error, fallbackMessage = 'Ocurrió un error inesperado.' }) {
  if (!error) return null

  const isBusiness = isBusinessError(error)
  const message = error?.response?.data?.detail || fallbackMessage
  const Icon = isBusiness ? AlertTriangle : XCircle

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
      isBusiness
        ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-200'
        : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-200'
    }`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}
