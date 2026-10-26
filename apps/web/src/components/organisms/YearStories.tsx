import { useRef, useState, type ReactNode } from 'react'
import { IconButton } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface YearStoriesProps {
  count: number
  /** Pinta la tarjeta `i`; `near` dice si está cerca de la visible (para cargar su imagen). */
  renderCard: (index: number, near: boolean) => ReactNode
  className?: string
}

/** Tarjetas verticales que se pasan deslizando (scroll-snap), con flechas y puntos. */
export function YearStories({ count, renderCard, className }: YearStoriesProps) {
  const track = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const go = (i: number) => {
    const el = track.current?.children[Math.max(0, Math.min(count - 1, i))] as HTMLElement | undefined
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        ref={track}
        role="region"
        aria-roledescription="carrusel"
        aria-label="Tu año en tarjetas"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(active + 1)
          if (e.key === 'ArrowLeft') go(active - 1)
        }}
        onScroll={(e) => {
          const el = e.currentTarget
          const first = el.children[0] as HTMLElement | undefined
          const step = first ? first.offsetWidth + 16 : el.clientWidth
          setActive(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / step))))
        }}
        className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-[max(1.25rem,calc(50%-12rem))] pb-2 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring"
      >
        {Array.from({ length: count }, (_, i) => renderCard(i, Math.abs(i - active) <= 1))}
      </div>
      <div className="flex items-center gap-3">
        <IconButton icon="back" label="Tarjeta anterior" disabled={active === 0} onClick={() => go(active - 1)} />
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} className={cn('size-2 rounded-full transition-colors', i === active ? 'bg-domain' : 'bg-border')} />
          ))}
        </div>
        <IconButton icon="back" label="Tarjeta siguiente" className="rotate-180" disabled={active === count - 1} onClick={() => go(active + 1)} />
      </div>
      <p className="sr-only" role="status">{`Tarjeta ${active + 1} de ${count}`}</p>
    </div>
  )
}
