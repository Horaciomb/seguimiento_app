import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import MutationAlert from '@/components/ui/mutation-alert'
import { cn } from '@/lib/utils'

const ACCENTS = {
  indigo: { border: 'border-t-indigo-500', icon: 'text-indigo-500' },
  emerald: { border: 'border-t-emerald-500', icon: 'text-emerald-500' },
  amber: { border: 'border-t-amber-500', icon: 'text-amber-500' },
}

export default function MutationDialog({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  accent = 'indigo',
  mutation,
  onSubmit,
  canSubmit = true,
  submitLabel = 'Guardar',
  pendingLabel = 'Guardando…',
  errorMessage,
  children,
}) {
  const a = ACCENTS[accent] ?? ACCENTS.indigo
  const btnStyled = 'h-11 md:h-9 text-sm md:text-xs'

  const cerrar = () => {
    mutation?.reset?.()
    onClose?.()
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className={cn('max-w-md border-t-4 shadow-xl', a.border)}>
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            {Icon && <Icon className={cn('h-5 w-5 shrink-0', a.icon)} />}
            {title}
          </DialogTitle>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </DialogHeader>

        <div className="space-y-4 py-2">{children}</div>

        {mutation?.isError && <MutationAlert error={mutation.error} fallbackMessage={errorMessage} />}

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={cerrar} className={btnStyled}>
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || mutation?.isPending}
            className={cn(btnStyled, 'font-semibold')}
          >
            {mutation?.isPending ? pendingLabel : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
