import { useState } from 'react'
import { Button, Icon } from '@/components/atoms'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { activeFirst } from '@/lib/filters'
import { cn } from '@/lib/utils'
import { BottomSheet } from './BottomSheet'

interface RefineChipsProps {
  options: { key: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  /** Nombre del filtro ("Géneros"): va en el botón que abre la hoja con todas las opciones. */
  label?: string
}

/** Chip de filtro pequeño: marca de verificación y color de la temática cuando está activo. */
const chipClass = cn(
  'group/chip h-8 shrink-0 gap-1 rounded-full! border-[1.5px] border-border bg-card px-3 text-[13px] font-semibold text-foreground shadow-none touch:h-9',
  'transition-[background-color,border-color,color] duration-200 ease-standard motion-reduce:transition-none',
  'hover:border-domain/60 hover:bg-domain-soft focus-visible:ring-2 focus-visible:ring-domain focus-visible:ring-offset-1 focus-visible:ring-offset-background',
  'data-[state=on]:border-domain data-[state=on]:bg-domain-soft data-[state=on]:text-domain',
)

function Chips({ options, value, onChange, disabled, ariaLabel, className }: Pick<RefineChipsProps, 'options' | 'value' | 'onChange' | 'disabled'> & { ariaLabel: string; className?: string }) {
  return (
    <ToggleGroup type="multiple" value={value} onValueChange={onChange} disabled={disabled} aria-label={ariaLabel} className={className}>
      {options.map((o) => (
        <ToggleGroupItem key={o.key} value={o.key} className={chipClass}>
          <Icon name="check" className="hidden size-3.5 group-data-[state=on]/chip:block" aria-hidden />
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/**
 * Filtros compactos: solo un botón con el nombre y el número de activos (abre una hoja con
 * todas las opciones, «Limpiar» y «Listo») y una ✕ para quitarlos todos. Las opciones se ven
 * al abrirlo, no ocupan sitio en la página.
 */
export function RefineChips({ options, value, onChange, disabled, label = 'Afinar' }: RefineChipsProps) {
  const [open, setOpen] = useState(false)
  const ariaLabel = label === 'Afinar' ? 'Afinar la lista' : label
  const count = value.length
  return (
    <div className="flex min-w-0 items-start gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-label={count ? `${label}: ${count} activos. Ver todos` : `${label}: ver todos`}
        className={cn(
          'inline-flex h-8 flex-none items-center gap-1.5 rounded-full border-[1.5px] px-2.5 text-[13px] font-bold touch:h-9',
          'focus-visible:ring-2 focus-visible:ring-domain focus-visible:outline-none disabled:opacity-50',
          count ? 'border-domain bg-domain-soft text-domain' : 'border-border hover:bg-secondary',
        )}
      >
        <Icon name="filter" className="size-4" />
        {label}
        {count > 0 && (
          <span aria-hidden className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-domain px-1 font-mono text-[11px] text-background">
            {count}
          </span>
        )}
      </button>
      {count > 0 && !disabled && (
        <button
          type="button"
          onClick={() => onChange([])}
          aria-label={`Quitar ${count === 1 ? 'el filtro' : `los ${count} filtros`}`}
          title="Limpiar"
          className="grid size-8 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-domain focus-visible:outline-none touch:size-9"
        >
          <Icon name="close" className="size-4" />
        </button>
      )}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <>
            <Button variant="secondary" size="md" className="flex-1" disabled={count === 0} onClick={() => onChange([])}>
              Limpiar
            </Button>
            <Button size="md" className="flex-1" onClick={() => setOpen(false)}>
              Listo
            </Button>
          </>
        }
      >
        <Chips options={activeFirst(options, value)} value={value} onChange={onChange} disabled={disabled} ariaLabel={ariaLabel} className="flex flex-wrap justify-start gap-2" />
      </BottomSheet>
    </div>
  )
}
