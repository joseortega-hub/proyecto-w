import { useState } from 'react'
import { Icon } from '@/components/atoms'
import { cn } from '@/lib/utils'
import { BottomSheet } from './BottomSheet'
import type { DomainTab } from './DomainTabs'

interface DomainPickerProps {
  tabs: DomainTab[]
  current: string
  onSelect: (id: string) => void
  /** «pill»: botón de la cabecera; «tab»: hueco de una barra inferior (icono arriba, nombre abajo). */
  variant?: 'pill' | 'tab'
  className?: string
}

/**
 * La única forma de cambiar de temática en el móvil: un botón con la actual (icono, color y
 * nombre) que abre una hoja con todas. Ocupa lo mismo tenga la app 3 temáticas o 10.
 */
export function DomainPicker({ tabs, current, onSelect, variant = 'pill', className }: DomainPickerProps) {
  const [open, setOpen] = useState(false)
  const active = tabs.find((t) => t.id === current)
  const select = (id: string) => {
    setOpen(false)
    if (id !== current) onSelect(id)
  }
  return (
    <>
      <button
        type="button"
        data-domain={active?.id}
        aria-haspopup="dialog"
        aria-label={`Temática: ${active?.label ?? 'ninguna'}. Cambiar de temática`}
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-w-0 items-center focus-visible:ring-2 focus-visible:ring-domain focus-visible:outline-none',
          variant === 'pill'
            ? 'h-10 gap-1.5 rounded-full border-[1.5px] border-domain/40 bg-domain-soft pr-2.5 pl-3 text-[14px] font-bold text-domain hover:border-domain touch:h-11'
            : 'min-h-11 flex-col justify-center gap-[3px] px-0.5 py-1 text-[11px] font-bold text-domain min-[360px]:text-xs',
          className,
        )}
      >
        <Icon name={active?.icon ?? 'domains'} className={cn('flex-none', variant === 'pill' ? 'size-[18px]' : 'size-[22px]')} />
        <span className="max-w-full min-w-0 truncate">{active?.label ?? 'Temáticas'}</span>
        {variant === 'pill' && <Icon name="chevronDown" className="size-4 flex-none opacity-70" />}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Temáticas">
        <div role="group" aria-label="Temáticas" className="grid grid-cols-2 gap-2">
          {tabs.map((t) => {
            const isActive = t.id === current
            return (
              <button
                key={t.id}
                type="button"
                data-domain={t.id}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => select(t.id)}
                className={cn(
                  'flex min-h-14 items-center gap-3 rounded-xl border-[1.5px] px-3 text-left focus-visible:ring-2 focus-visible:ring-domain focus-visible:outline-none',
                  isActive ? 'border-domain bg-domain-soft text-domain' : 'border-border hover:bg-secondary',
                )}
              >
                <Icon name={t.icon} className="size-5 flex-none text-domain" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{t.label}</span>
                  {t.count != null && <span className="block text-[12px] text-muted-foreground">{t.count} elementos</span>}
                </span>
              </button>
            )
          })}
        </div>
      </BottomSheet>
    </>
  )
}
