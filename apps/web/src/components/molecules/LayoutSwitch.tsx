import { Icon } from '@/components/atoms'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ResultLayout } from '@/lib/swipe'
import { cn } from '@/lib/utils'

interface LayoutSwitchProps {
  value: ResultLayout
  onChange: (value: ResultLayout) => void
  className?: string
}

const OPTIONS: { value: ResultLayout; label: string; icon: 'lists' | 'swipe' }[] = [
  { value: 'list', label: 'Lista', icon: 'lists' },
  { value: 'swipe', label: 'Desliza', icon: 'swipe' },
]

/** Cómo ver el resultado: la lista de siempre o una tarjeta cada vez para deslizar. */
export function LayoutSwitch({ value, onChange, className }: LayoutSwitchProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as ResultLayout)}
      aria-label="Cómo ver tu lista"
      className={cn('flex w-full gap-1 rounded-full bg-secondary p-1', className)}
    >
      {OPTIONS.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-10 touch:h-11 flex-1 gap-1.5 rounded-full! text-sm font-bold text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          <Icon name={o.icon} className="size-4" />
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
