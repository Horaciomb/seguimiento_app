import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const EMPTY_ITEMS = []

export default function SelectField({
  value,
  onValueChange,
  items = EMPTY_ITEMS,
  placeholder = 'Seleccionar…',
  renderLabel,
  disabled = false,
  id,
  triggerClassName,
  valueClassName = 'text-sm',
  itemClassName = 'text-sm md:text-xs',
  contentClassName,
}) {
  const norm = items.map((it) => (typeof it === 'string' ? { value: it, label: it } : it))
  const grupos = []
  for (const it of norm) {
    const titulo = it.grupo || ''
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.titulo === titulo) ultimo.items.push(it)
    else grupos.push({ titulo, items: [it] })
  }
  const hayGrupos = grupos.some((g) => g.titulo)
  const seleccionado = norm.find((it) => String(it.value) === String(value))
  const display = value
    ? (renderLabel ? renderLabel(value) : (seleccionado ? seleccionado.label : value))
    : placeholder

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className={cn('h-11 md:h-9', triggerClassName)}>
        <span
          className={cn(
            'flex-1 min-w-0 truncate text-left',
            valueClassName,
            value ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {display}
        </span>
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {grupos.map((g) => {
          const opciones = g.items.map((it) => (
            <SelectItem key={it.value} value={String(it.value)} className={itemClassName}>
              {renderLabel ? renderLabel(it.value) : it.label}
            </SelectItem>
          ))
          if (!hayGrupos) return opciones
          return (
            <SelectGroup key={g.titulo || `sin-grupo-${g.items[0].value}`}>
              {g.titulo && <SelectLabel>{g.titulo}</SelectLabel>}
              {opciones}
            </SelectGroup>
          )
        })}
      </SelectContent>
    </Select>
  )
}
