import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Dialog } from 'radix-ui'
import { Icon, type IconName } from '@/components/atoms'
import { cn } from '@/lib/utils'

export interface DomainTab {
  id: string
  label: string
  icon: IconName
  /** Número de elementos (se muestra en la hoja "Todas"). */
  count?: number
}

interface DomainTabsProps {
  tabs: DomainTab[]
  current: string
  onSelect: (id: string) => void
  /** Horizontal (cabecera móvil, compacta) o vertical (barra lateral). */
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

/** Cambio de temática: cada pestaña con su icono y su color; la actual, rellena. */
export function DomainTabs({ tabs, current, onSelect, orientation = 'horizontal', className }: DomainTabsProps) {
  const vertical = orientation === 'vertical'
  const ref = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [open, setOpen] = useState(false)

  // Horizontal: solo la activa con nombre. Si aun así no caben, aparece "Todas".
  useLayoutEffect(() => {
    const el = ref.current
    if (vertical || !el) return
    const check = () => {
      // Con el botón "Todas" visible, el contenedor se estrecha; medimos contra el ancho total disponible.
      const needed = el.scrollWidth
      const available = el.parentElement?.clientWidth ?? el.clientWidth
      setOverflow((prev) => (prev ? needed > available - 80 : needed > available))
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el.parentElement ?? el)
    return () => ro.disconnect()
  }, [vertical, tabs.length, current])

  // Si aun con "Todas" la activa queda fuera de vista, la traemos.
  useEffect(() => {
    if (vertical) return
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [current, vertical, overflow])

  const select = (id: string) => {
    setOpen(false)
    onSelect(id)
  }

  return (
    <div className={cn(!vertical && 'flex items-center gap-1', className)}>
      <div
        ref={ref}
        role="group"
        aria-label="Temáticas"
        className={cn(vertical ? 'flex flex-col gap-1' : 'flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]')}
      >
        {tabs.map((t) => {
          const active = t.id === current
          return (
            <button
              key={t.id}
              type="button"
              data-domain={t.id}
              aria-label={vertical ? undefined : t.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => onSelect(t.id)}
              className={cn(
                'flex flex-none items-center transition-all duration-200 motion-reduce:transition-none',
                vertical
                  ? 'min-h-10 gap-2 rounded-md px-3 text-[14px]'
                  : cn('h-9 justify-center rounded-full border-[1.5px] text-[13px]', active ? 'gap-1.5 px-2.5' : 'w-9'),
                active
                  ? cn('bg-domain-soft font-bold text-domain', !vertical && 'border-domain')
                  : cn('text-muted-foreground hover:bg-secondary', !vertical && 'border-border'),
              )}
            >
              <Icon name={t.icon} className={cn('size-4 flex-none', active && 'text-domain')} />
              {(vertical || active) && <span className={cn('whitespace-nowrap', !vertical && 'animate-in fade-in-0 slide-in-from-left-1 duration-200')}>{t.label}</span>}
            </button>
          )
        })}
      </div>
      {!vertical && overflow && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger
            aria-label="Todas las temáticas"
            className="flex h-9 flex-none items-center rounded-full border-[1.5px] border-border px-3 text-[13px] text-muted-foreground hover:bg-secondary"
          >
            Todas
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground shadow-xl data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom">
              <Dialog.Title className="mb-3 text-[15px] font-bold">Temáticas</Dialog.Title>
              <Dialog.Description className="sr-only">Elige la temática que quieres explorar.</Dialog.Description>
              <div className="grid grid-cols-2 gap-2">
                {tabs.map((t) => {
                  const active = t.id === current
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-domain={t.id}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => select(t.id)}
                      className={cn(
                        'flex min-h-14 items-center gap-3 rounded-xl border-[1.5px] px-3 text-left',
                        active ? 'border-domain bg-domain-soft text-domain' : 'border-border hover:bg-secondary',
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
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  )
}
