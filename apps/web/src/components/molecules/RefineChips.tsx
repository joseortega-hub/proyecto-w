import { useState } from 'react'
import { Button, Icon, Text } from '@/components/atoms'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { BottomSheet } from './BottomSheet'

interface RefineChipsProps {
  options: { key: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
  /** Título del grupo; también sirve para filtros ("Géneros"). */
  label?: string
  /** A partir de cuántas opciones el móvil enseña una fila deslizable y el resto en una hoja. */
  sheetFrom?: number
}

/** Píldora de filtro: marca de verificación y color de la temática cuando está activa. */
const chipClass = cn(
  'group/chip h-9 touch:h-11 shrink-0 gap-1.5 rounded-full! border-[1.5px] border-border bg-card px-3.5 text-sm font-bold text-foreground shadow-none',
  'transition-[background-color,border-color,color,box-shadow] duration-200 ease-standard motion-reduce:transition-none',
  'hover:border-domain/60 hover:bg-domain-soft focus-visible:ring-2 focus-visible:ring-domain focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'data-[state=on]:border-domain data-[state=on]:bg-domain-soft data-[state=on]:text-foreground data-[state=on]:shadow-[inset_0_0_0_1px_var(--domain)]',
)

function Chips({ options, value, onChange, disabled, ariaLabel, className }: Pick<RefineChipsProps, 'options' | 'value' | 'onChange' | 'disabled'> & { ariaLabel: string; className?: string }) {
  return (
    <ToggleGroup type="multiple" value={value} onValueChange={onChange} disabled={disabled} aria-label={ariaLabel} className={className}>
      {options.map((o) => (
        <ToggleGroupItem key={o.key} value={o.key} className={chipClass}>
          <Icon name="check" className="hidden size-4 text-domain group-data-[state=on]/chip:block" aria-hidden />
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/**
 * Filtros o ajustes rápidos en píldoras. Contador de activos y «Limpiar» a mano; en el móvil,
 * si hay muchas opciones, una fila que se desliza y «Todos» abre una hoja con todas.
 */
export function RefineChips({ options, value, onChange, disabled, label = 'Afinar', sheetFrom = 7 }: RefineChipsProps) {
  const [open, setOpen] = useState(false)
  const ariaLabel = label === 'Afinar' ? 'Afinar la lista' : label
  const many = options.length >= sheetFrom
  // En la fila del móvil van primero las activas, para que se vean sin deslizar.
  const row = many ? [...options.filter((o) => value.includes(o.key)), ...options.filter((o) => !value.includes(o.key))] : options
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-8 items-center gap-2">
        <Text as="span" font="label">
          {label}
        </Text>
        {value.length > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-domain px-1.5 font-mono text-[11px] font-bold text-background" aria-label={`${value.length} activos`}>
            {value.length}
          </span>
        )}
        <span className="flex-1" />
        {value.length > 0 && !disabled && (
          <button type="button" onClick={() => onChange([])} className="inline-flex min-h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold text-muted-foreground hover:bg-secondary hover:text-foreground touch:min-h-11">
            <Icon name="close" className="size-3.5" />
            Limpiar
          </button>
        )}
        {many && (
          <button type="button" onClick={() => setOpen(true)} disabled={disabled} className="inline-flex min-h-8 items-center gap-1 rounded-full border-[1.5px] border-border px-3 text-[13px] font-bold touch:min-h-11 md:hidden">
            Todos
            <Icon name="chevronDown" className="size-3.5" />
          </button>
        )}
      </div>
      <Chips
        options={row}
        value={value}
        onChange={onChange}
        disabled={disabled}
        ariaLabel={ariaLabel}
        className={cn(
          'flex w-full gap-2',
          many
            ? // Fila deslizable en el móvil, con el borde derecho difuminado; en escritorio, todas en varias líneas.
              '-mx-5 w-auto flex-nowrap justify-start overflow-x-auto px-5 pb-1 [mask-image:linear-gradient(to_right,black_85%,transparent)] [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:[mask-image:none]'
            : 'flex-wrap justify-start',
        )}
      />
      {many && (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title={label}
          footer={
            <>
              <Button variant="secondary" size="md" className="flex-1" disabled={value.length === 0} onClick={() => onChange([])}>
                Limpiar
              </Button>
              <Button size="md" className="flex-1" onClick={() => setOpen(false)}>
                Listo
              </Button>
            </>
          }
        >
          <Chips options={options} value={value} onChange={onChange} disabled={disabled} ariaLabel={ariaLabel} className="flex flex-wrap justify-start gap-2" />
        </BottomSheet>
      )}
    </div>
  )
}
