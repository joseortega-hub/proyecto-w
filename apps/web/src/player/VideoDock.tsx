import { useLayoutEffect, useState, type CSSProperties, type Ref } from 'react'
import { Icon } from '@/components/atoms/Icon'
import { cn } from '@/lib/utils'
import { pickSlot, sameRect, type SlotRect } from './video-slot'

interface VideoDockProps {
  ref: Ref<HTMLDivElement>
  /** Si lo que suena es un vídeo de YouTube. */
  visible: boolean
  /** Si el vídeo está sonando: sin hueco en pantalla, solo flota mientras suena. */
  playing: boolean
  /** Huecos del reproductor de Sintonía (portada del mini-reproductor, la barra o el reproductor completo). */
  slots: HTMLElement[]
  title?: string
  /** Cierra el reproductor (para el vídeo y vacía la cola). */
  onClose: () => void
}

/**
 * Contenedor único del IFrame de YouTube. Vive fuera de las rutas para que el vídeo no se
 * recargue al navegar, y se coloca encima de la portada del reproductor de Sintonía: el
 * vídeo hace de portada viva y los controles son siempre los de Sintonía. Solo si no hay
 * reproductor en pantalla (la entrevista, «Hoy para ti») flota en una esquina mientras suena,
 * porque YouTube pide que se vea, y siempre con un botón para cerrarlo.
 */
export function VideoDock({ ref, visible, playing, slots, title, onClose }: VideoDockProps) {
  const [rect, setRect] = useState<SlotRect | null>(null)

  // Se mide en cada fotograma mientras hay vídeo: los huecos se mueven con animaciones,
  // hojas y transiciones de página sin que cambie su tamaño, y el vídeo no puede quedarse atrás.
  useLayoutEffect(() => {
    if (!visible) return setRect(null)
    let frame = 0
    const tick = () => {
      const next = pickSlot(slots, window.innerWidth, window.innerHeight)
      setRect((prev) => (sameRect(prev, next) ? prev : next))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [slots, visible])

  const docked = visible && rect !== null
  const floating = visible && !rect && playing
  const style: CSSProperties | undefined = docked ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : undefined

  return (
    <div
      style={style}
      data-state={docked ? 'docked' : floating ? 'floating' : 'hidden'}
      className={cn(
        'fixed z-40 overflow-hidden bg-black',
        !docked && !floating && 'pointer-events-none top-0 left-0 size-px opacity-0',
        // Encima de la portada: los toques pasan al reproductor de Sintonía (abrirlo, pausar…).
        docked && 'pointer-events-none rounded-[8px]',
        floating &&
          'right-3 bottom-[calc(88px+env(safe-area-inset-bottom))] aspect-video w-40 rounded-[10px] shadow-xl ring-1 ring-white/15 md:right-6 md:bottom-6 md:w-56',
      )}
    >
      <div ref={ref} aria-label={title ? `Vídeo de YouTube: ${title}` : 'Reproductor de YouTube'} className="size-full [&_iframe]:pointer-events-none [&_iframe]:size-full" />
      {floating && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el vídeo"
          className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-black/70 text-white outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Icon name="close" className="size-4" />
        </button>
      )}
    </div>
  )
}
