import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

/** Al tacto, el asa se agarra con una pulsación larga; antes de eso, el dedo hace scroll (igual que "Tu vibra"). */
const HOLD_MS = 300
const HOLD_SLOP = 8
const EDGE = 70

interface Options {
  /** Contenedor de la lista (`<ol>`): sus hijos directos son las filas. */
  listRef: RefObject<HTMLElement | null>
  onMove: (from: number, to: number) => void
}

/**
 * Reordenar arrastrando un asa (ratón, lápiz o táctil) o con las flechas ↑/↓ del asa enfocada.
 * El puntero se captura en la lista, no en el asa: al reordenar, React mueve el nodo y perdería la captura.
 */
export function useDragReorder({ listRef, onMove }: Options) {
  const [dragging, setDragging] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<{ index: number; id: string; pointerId: number; x: number; y: number } | null>(null)
  const lastY = useRef(0)
  const focusId = useRef<string | null>(null)
  const moveRef = useRef(onMove)
  moveRef.current = onMove

  const setDrag = (index: number | null) => {
    dragRef.current = index
    setDragging(index)
  }

  const targetAt = useCallback(
    (y: number) => {
      const rows = Array.from(listRef.current?.children ?? [])
      if (!rows.length) return null
      const found = rows.findIndex((r) => y < r.getBoundingClientRect().bottom)
      return found === -1 ? rows.length - 1 : found
    },
    [listRef],
  )
  const follow = useCallback(() => {
    const from = dragRef.current
    if (from === null) return
    const to = targetAt(lastY.current)
    if (to !== null && to !== from) {
      moveRef.current(from, to)
      setDrag(to)
    }
  }, [targetAt])

  const scroller = () => {
    for (let el = listRef.current?.parentElement; el; el = el.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) return el
    }
    return null
  }

  // Mientras se arrastra: sin scroll del dedo (oyente no pasivo) y la lista se desplaza si el dedo llega al borde.
  useEffect(() => {
    const el = listRef.current
    if (!el || dragging === null) return
    const block = (e: TouchEvent) => e.preventDefault()
    el.addEventListener('touchmove', block, { passive: false })
    const box = scroller()
    const timer = window.setInterval(() => {
      if (!box) return
      const r = box.getBoundingClientRect()
      const dy = lastY.current < r.top + EDGE ? -10 : lastY.current > r.bottom - EDGE ? 10 : 0
      if (dy) {
        box.scrollBy(0, dy)
        follow()
      }
    }, 16)
    return () => {
      el.removeEventListener('touchmove', block)
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging !== null, follow, listRef])

  useEffect(() => () => clearTimeout(hold.current), [])

  // Tras mover con el teclado, el nodo cambia de sitio y pierde el foco: se devuelve al asa.
  useLayoutEffect(() => {
    if (!focusId.current) return
    listRef.current?.querySelector<HTMLElement>(`[data-handle="${focusId.current}"]`)?.focus({ preventScroll: false })
    focusId.current = null
  })

  const grab = (index: number, pointerId: number, y: number) => {
    navigator.vibrate?.(15)
    lastY.current = y
    listRef.current?.setPointerCapture(pointerId)
    setDrag(index)
  }

  const release = () => {
    clearTimeout(hold.current)
    hold.current = undefined
    pending.current = null
    if (dragRef.current !== null) setDrag(null)
  }

  const handleProps = (index: number, id: string, count: number) => ({
    'data-handle': id,
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType !== 'touch') {
        e.preventDefault()
        return grab(index, e.pointerId, e.clientY)
      }
      pending.current = { index, id, pointerId: e.pointerId, x: e.clientX, y: e.clientY }
      clearTimeout(hold.current)
      hold.current = setTimeout(() => {
        const p = pending.current
        if (p) grab(p.index, p.pointerId, lastY.current || p.y)
      }, HOLD_MS)
    },
    onKeyDown: (e: KeyboardEvent) => {
      const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : null
      if (to === null) return
      e.preventDefault()
      if (to < 0 || to >= count || to === index) return
      focusId.current = id
      moveRef.current(index, to)
    },
  })

  const listProps = {
    onPointerMove: (e: PointerEvent) => {
      lastY.current = e.clientY
      const p = pending.current
      if (p && dragRef.current === null && Math.hypot(e.clientX - p.x, e.clientY - p.y) > HOLD_SLOP) {
        clearTimeout(hold.current)
        pending.current = null
      }
      if (dragRef.current !== null) follow()
    },
    onPointerUp: release,
    onPointerCancel: release,
    onContextMenu: (e: { preventDefault: () => void }) => {
      if (dragRef.current !== null || pending.current) e.preventDefault()
    },
  }

  return { dragging, handleProps, listProps }
}
