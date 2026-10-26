import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { IconButton, Spinner, Text } from '@/components/atoms'
import { SwipeCard } from '@/components/molecules'
import type { ResultEntry } from '@/lib/api'
import { classifySwipe, swipeTransition, type Gesture, type Verdict } from '@/lib/swipe'
import { cn } from '@/lib/utils'

interface SwipeDeckProps {
  /** Lo que queda por ver; la primera es la de arriba. */
  cards: ResultEntry[]
  onGesture: (gesture: Gesture, entry: ResultEntry) => void
  /** Deshacer el último gesto; sin él no se muestra el botón. */
  onUndo?: () => void
  /** El último gesto (para que la tarjeta vuelva por su lado al deshacer). */
  lastVerdict?: Verdict | null
  /** Si la tarjeta ya está en la lista (las extra todavía no). */
  inList?: (itemId: string) => boolean
  detail?: (entry: ResultEntry) => string | null
  /** Reproducir o abrir en la fuente, según la temática. */
  actions?: (entry: ResultEntry) => ReactNode
  /** Debajo de las acciones («Ya la vi»). */
  footer?: (entry: ResultEntry) => ReactNode
  /** Pidiendo más parecidas. */
  loading?: boolean
  /** Qué mostrar cuando no quedan tarjetas. */
  empty?: ReactNode
  className?: string
}

interface Drag {
  id: number
  x: number
  y: number
  t: number
  vx: number
  vy: number
  dx: number
  dy: number
}

/**
 * «Desliza»: una tarjeta cada vez. Derecha = me gusta, izquierda = no, arriba = ver ficha.
 * Gestos con Pointer Events (ratón, dedo o lápiz), con los mismos gestos en botones y flechas
 * del teclado, y animación con View Transitions cuando el navegador la tiene.
 */
export function SwipeDeck({ cards, onGesture, onUndo, lastVerdict, inList = () => true, detail, actions, footer, loading, empty, className }: SwipeDeckProps) {
  const cardRef = useRef<HTMLElement>(null)
  const drag = useRef<Drag | null>(null)
  const [announce, setAnnounce] = useState('')
  const top = cards[0]
  const next = cards[1]

  const setVisual = (dx: number, dy: number, animate = false) => {
    const el = cardRef.current
    if (!el) return
    const need = Math.max(80, el.offsetWidth * 0.28)
    el.style.transition = animate ? 'transform 0.2s ease-out' : 'none'
    el.style.transform = dx || dy ? `translate(${dx}px, ${dy}px) rotate(${dx / 20}deg)` : ''
    const horizontal = Math.abs(dx) >= Math.abs(dy)
    el.style.setProperty('--like', String(horizontal ? Math.min(1, Math.max(0, dx / need)) : 0))
    el.style.setProperty('--nope', String(horizontal ? Math.min(1, Math.max(0, -dx / need)) : 0))
    el.style.setProperty('--up', String(horizontal ? 0 : Math.min(1, Math.max(0, -dy / need))))
  }

  const act = (gesture: Gesture, dx = 0, dy = 0) => {
    if (!top) return
    if (gesture === 'detail') {
      setVisual(0, 0)
      return onGesture('detail', top)
    }
    setAnnounce(gesture === 'like' ? `Te gusta «${top.item.title}». Está en tu lista.` : `«${top.item.title}» queda fuera de la lista.`)
    swipeTransition({ kind: gesture, dx, dy }, () => onGesture(gesture, top))
  }

  const undo = () => {
    if (!onUndo) return
    setAnnounce('Último gesto deshecho.')
    swipeTransition({ kind: lastVerdict === 'nope' ? 'undo-nope' : 'undo-like' }, onUndo)
  }

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, vx: 0, vy: 0, dx: 0, dy: 0 }
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    const dt = Math.max(1, e.timeStamp - d.t)
    d.vx = (dx - d.dx) / dt
    d.vy = (dy - d.dy) / dt
    d.dx = dx
    d.dy = dy
    d.t = e.timeStamp
    setVisual(dx, dy)
  }
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    const gesture = classifySwipe(d.dx, d.dy, cardRef.current?.offsetWidth ?? 320, d.vx, d.vy)
    if (gesture) act(gesture, d.dx, d.dy)
    else setVisual(0, 0, true)
  }
  const onPointerCancel = () => {
    drag.current = null
    setVisual(0, 0, true)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input, textarea, select')) return
    const gesture = ({ ArrowRight: 'like', ArrowLeft: 'nope', ArrowUp: 'detail' } as const)[e.key as 'ArrowRight']
    if (gesture) {
      e.preventDefault()
      act(gesture)
    } else if (onUndo && (e.key === 'Backspace' || e.key.toLowerCase() === 'z')) {
      e.preventDefault()
      undo()
    }
  }

  return (
    <section aria-label="Desliza tu lista" onKeyDown={onKeyDown} className={cn('flex flex-col gap-3', className)}>
      <p role="status" className="sr-only">
        {announce}
      </p>
      {top ? (
        <>
          <Text size="sm" tone="muted" className="text-center">
            Desliza: derecha si te gusta, izquierda si no, arriba para ver la ficha.
          </Text>
          <div className="relative">
            {next && (
              <div aria-hidden className="pointer-events-none absolute inset-x-3 top-2 bottom-0 translate-y-2 scale-[0.97] rounded-[22px] border border-border bg-card opacity-70" />
            )}
            <SwipeCard
              key={top.item.id}
              ref={cardRef}
              tabIndex={0}
              aria-roledescription="tarjeta"
              aria-label={`${top.item.title}${top.item.subtitle ? `, ${top.item.subtitle}` : ''}. Flecha derecha: me gusta. Flecha izquierda: no. Flecha arriba: ver ficha.`}
              title={top.item.title}
              subtitle={top.item.subtitle}
              imageUrl={top.item.imageUrl}
              reason={top.reason}
              likes={top.likes}
              match={top.match}
              detail={detail?.(top)}
              inList={inList(top.item.id)}
              actions={actions?.(top)}
              footer={footer?.(top)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              className="swipe-top relative cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            />
          </div>
          <Text size="xs" tone="muted" className="text-center tabular-nums" aria-hidden>
            {loading ? 'Buscando más propuestas…' : `Quedan ${cards.length}`}
          </Text>
        </>
      ) : loading ? (
        <div className="flex min-h-60 flex-col items-center justify-center gap-2">
          <Spinner label="Buscando más propuestas" />
          <Text size="sm" tone="muted">Buscando más propuestas…</Text>
        </div>
      ) : (
        empty
      )}
      <div role="group" aria-label="Gestos" className="flex items-center justify-center gap-3">
        <IconButton icon="undo" label="Deshacer el último gesto" aria-keyshortcuts="Z" disabled={!onUndo} onClick={undo} />
        <IconButton icon="thumbsDown" size="lg" label="No es para mí" aria-keyshortcuts="ArrowLeft" disabled={!top} onClick={() => act('nope')} />
        <IconButton icon="info" label="Ver la ficha" aria-keyshortcuts="ArrowUp" disabled={!top} onClick={() => act('detail')} />
        <IconButton icon="heart" size="lg" variant="primary" label="Me gusta" aria-keyshortcuts="ArrowRight" disabled={!top} onClick={() => act('like')} />
      </div>
    </section>
  )
}
