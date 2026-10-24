import { useLayoutEffect, useState, type CSSProperties, type Ref } from 'react'
import { cn } from '@/lib/utils'

interface VideoDockProps {
  ref: Ref<HTMLDivElement>
  visible: boolean
  /** Hueco del reproductor a pantalla completa; sin él, ventanita flotante sobre la navegación. */
  slot: HTMLElement | null
  title?: string
}

/**
 * Contenedor único del IFrame de YouTube. Vive fuera de las rutas para que el vídeo no se
 * recargue al navegar: se coloca encima del hueco del reproductor o, si no hay, flota en
 * una esquina (las condiciones de YouTube piden que el reproductor se vea).
 */
export function VideoDock({ ref, visible, slot, title }: VideoDockProps) {
  const [rect, setRect] = useState<CSSProperties | null>(null)

  useLayoutEffect(() => {
    if (!slot) return setRect(null)
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = slot.getBoundingClientRect()
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(slot)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [slot])

  return (
    <div
      ref={ref}
      aria-label={title ? `Vídeo de YouTube: ${title}` : 'Reproductor de YouTube'}
      style={visible && rect ? rect : undefined}
      className={cn(
        'fixed z-40 overflow-hidden bg-black [&_iframe]:size-full',
        !visible && 'pointer-events-none top-0 left-0 size-px opacity-0',
        visible && rect && 'rounded-lg shadow-lg',
        // Encima del mini-reproductor y la navegación inferior en móvil; sobre la barra en escritorio.
        visible && !rect && 'right-3 bottom-[148px] aspect-video w-44 rounded-[10px] shadow-xl md:right-6 md:bottom-24 md:w-64',
      )}
    />
  )
}
