import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function PaginationBar({ page, pageSize, total, onPageChange, className }) {
  if (!total || (total <= pageSize && page === 1)) return null

  const desde = (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)
  const esUltima = page * pageSize >= total

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm', className)}>
      <span className="text-sm text-muted-foreground text-center sm:text-left">
        {`Mostrando ${desde}–${hasta} de ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="touch" onClick={() => onPageChange(page - 1)} disabled={page === 1}
          className="flex-1 sm:flex-none sm:h-7 sm:px-2.5 sm:text-[0.8rem]">
          Anterior
        </Button>
        <Button variant="outline" size="touch" onClick={() => onPageChange(page + 1)} disabled={esUltima}
          className="flex-1 sm:flex-none sm:h-7 sm:px-2.5 sm:text-[0.8rem]">
          Siguiente
        </Button>
      </div>
    </div>
  )
}
