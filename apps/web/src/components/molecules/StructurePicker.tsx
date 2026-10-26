import { Icon } from '@/components/atoms'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { LAYOUTS, type LayoutId } from '@/lib/layout'
import { cn } from '@/lib/utils'

interface StructurePickerProps {
  value: LayoutId
  onChange: (value: LayoutId) => void
  className?: string
}

/** Miniatura de cada estructura: dónde va la navegación respecto al contenido. */
function Sketch({ id }: { id: LayoutId }) {
  const bar = 'rounded-[3px] bg-domain/70'
  const block = 'rounded-[3px] bg-muted-foreground/25'
  return (
    <span aria-hidden className="relative flex h-14 w-full overflow-hidden rounded-md border border-border bg-background p-1">
      {id === 'app' && (
        <span className="flex w-full flex-col gap-1">
          <span className={cn(block, 'h-1.5 w-1/2 self-end opacity-60')} />
          <span className={cn(block, 'flex-1')} />
          <span className={cn(bar, 'h-2.5')} />
        </span>
      )}
      {id === 'library' && (
        <span className="flex w-full flex-col gap-1">
          <span className="flex gap-1">
            <span className={cn(bar, 'h-1.5 flex-1')} />
            <span className={cn(block, 'h-1.5 flex-1')} />
            <span className={cn(block, 'h-1.5 flex-1')} />
          </span>
          <span className={cn(block, 'flex-1')} />
        </span>
      )}
      {id === 'dock' && (
        <>
          <span className={cn(block, 'w-full')} />
          <span className={cn(bar, 'absolute inset-x-3 bottom-1.5 h-2.5 rounded-full shadow')} />
          <span className="absolute bottom-1 left-1/2 size-3.5 -translate-x-1/2 rounded-full bg-primary ring-2 ring-background" />
        </>
      )}
      {id === 'thumb' && (
        <span className="flex w-full flex-col gap-1">
          <span className={cn(block, 'flex-1')} />
          <span className="flex h-3.5 gap-0.5">
            <span className="w-3.5 rounded-[3px] bg-primary" />
            <span className={cn(bar, 'flex-1')} />
          </span>
        </span>
      )}
      {id === 'focus' && (
        <span className="flex w-full flex-col gap-1">
          <span className={cn(bar, 'h-0.5 opacity-50')} />
          <span className={cn(block, 'flex-1')} />
          <span className={cn(bar, 'h-0.5 opacity-50')} />
        </span>
      )}
    </span>
  )
}

/** Elige la estructura de la interfaz (como el tema de color): con flechas del teclado o tocando. */
export function StructurePicker({ value, onChange, className }: StructurePickerProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as LayoutId)}
      aria-label="Estructura de la interfaz"
      className={cn('grid w-full grid-cols-3 gap-2', className)}
    >
      {LAYOUTS.map((l) => (
        <ToggleGroupItem
          key={l.id}
          value={l.id}
          title={l.description}
          aria-label={`${l.label}: ${l.description}`}
          className="flex h-auto flex-col items-stretch gap-1.5 rounded-lg! border-[1.5px] border-border bg-card p-1.5 text-[13px] font-bold transition-colors motion-reduce:transition-none hover:bg-secondary data-[state=on]:border-domain data-[state=on]:bg-domain-soft focus-visible:ring-2 focus-visible:ring-domain"
        >
          <Sketch id={l.id} />
          <span className="flex items-center justify-center gap-1">
            <Icon name={l.icon} className="size-3.5" />
            {l.label}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
