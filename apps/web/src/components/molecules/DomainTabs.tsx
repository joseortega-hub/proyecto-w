import { useEffect, useRef } from 'react'
import { Icon, type IconName } from '@/components/atoms'
import { cn } from '@/lib/utils'

export interface DomainTab {
  id: string
  label: string
  icon: IconName
}

interface DomainTabsProps {
  tabs: DomainTab[]
  current: string
  onSelect: (id: string) => void
  /** Horizontal (cabecera móvil, con scroll) o vertical (barra lateral). */
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

/** Cambio de temática: cada pestaña con su icono y su color; la actual, rellena. */
export function DomainTabs({ tabs, current, onSelect, orientation = 'horizontal', className }: DomainTabsProps) {
  const vertical = orientation === 'vertical'
  const ref = useRef<HTMLDivElement>(null)
  // En móvil las pestañas hacen scroll: la actual siempre a la vista.
  useEffect(() => {
    if (vertical) return
    const active = ref.current?.querySelector<HTMLElement>('[aria-current="page"]')
    if (active && ref.current) ref.current.scrollLeft = active.offsetLeft - ref.current.offsetLeft - 20
  }, [current, vertical, tabs.length])
  return (
    <div
      ref={ref}
      role="group"
      aria-label="Temáticas"
      className={cn(vertical ? 'flex flex-col gap-1' : 'flex gap-2 overflow-x-auto [scrollbar-width:none]', className)}
    >
      {tabs.map((t) => {
        const active = t.id === current
        return (
          <button
            key={t.id}
            type="button"
            data-domain={t.id}
            aria-current={active ? 'page' : undefined}
            onClick={() => onSelect(t.id)}
            className={cn(
              'flex flex-none items-center gap-2 transition-colors',
              vertical ? 'min-h-10 rounded-md px-3 text-[14px]' : 'min-h-9 rounded-full border-[1.5px] px-3 text-[13px]',
              active
                ? cn('bg-domain-soft font-bold text-domain', !vertical && 'border-domain')
                : cn('text-muted-foreground hover:bg-secondary', !vertical && 'border-border'),
            )}
          >
            <Icon name={t.icon} className={cn('size-4', active && 'text-domain')} />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
