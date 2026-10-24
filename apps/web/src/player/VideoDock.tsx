import { useLayoutEffect, useState, type CSSProperties, type Ref } from 'react'
import { cn } from '@/lib/utils'

interface VideoDockProps {
  ref: Ref<HTMLDivElement>
  visible: boolean
  /** Huecos del reproductor de Sintonía (portada del mini-reproductor, la barra o el reproductor completo). */
  slots: HTMLElement[]
  title?: string
}

/** El hueco visible más grande: el reproductor completo gana a la miniatura del mini-reproductor. */
function pickSlot(slots: HTMLElement[]) {
  let best: { rect: DOMRect; area: number } | null = null
  for (const slot of slots) {
    const rect = slot.getBoundingClientRect()
    const area = rect.width * rect.height
    if (area > 0 && (!best || area > best.area)) best = { rect, area }
  }
  return best?.rect ?? null
}

/**
 * Contenedor único del IFrame de YouTube. Vive fuera de las rutas para que el vídeo no se
 * recargue al navegar, y se coloca encima de la portada del reproductor de Sintonía: el
 * vídeo hace de portada viva y los controles son siempre los de Sintonía. Solo si no hay
 * reproductor en pantalla (la entrevista) flota en una esquina, porque YouTube pide que se vea.
 */
export function VideoDock({ ref, visible, slots, title }: VideoDockProps) {
  const [rect, setRect] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = pickSlot(slots)
        setRect(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
      })
    }
    update()
    const observer = new ResizeObserver(update)
    for (const slot of slots) observer.observe(slot)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [slots])

  return (
    <div
      ref={ref}
      aria-label={title ? `Vídeo de YouTube: ${title}` : 'Reproductor de YouTube'}
      style={visible && rect ? rect : undefined}
      className={cn(
        'fixed z-40 overflow-hidden bg-black [&_iframe]:size-full',
        !visible && 'pointer-events-none top-0 left-0 size-px opacity-0',
        // Encima de la portada: los toques pasan al reproductor de Sintonía (abrirlo, pausar…).
        visible && rect && 'pointer-events-none rounded-[8px]',
        visible && !rect && 'right-3 bottom-[calc(24px+env(safe-area-inset-bottom))] aspect-video w-40 rounded-[10px] shadow-xl md:right-6 md:bottom-6 md:w-56',
      )}
    />
  )
}
