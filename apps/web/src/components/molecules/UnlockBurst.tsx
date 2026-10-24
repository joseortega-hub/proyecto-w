import { useEffect } from 'react'
import { Icon } from '@/components/atoms'

interface UnlockBurstProps {
  /** Se llama al terminar la animación o al tocar para saltarla. */
  onDone: () => void
  /** Milisegundos que dura antes de terminar sola. */
  duration?: number
}

/** Animación de desbloqueo del Modo Perreo: destello neón a pantalla completa. */
export function UnlockBurst({ onDone, duration = 2200 }: UnlockBurstProps) {
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(onDone, reduced ? 900 : duration)
    return () => window.clearTimeout(timer)
  }, [onDone, duration])
  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="Modo Perreo desbloqueado. Toca para continuar"
      data-domain="perreo"
      className="fixed inset-0 z-50 grid place-items-center bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--domain)_55%,#000)_0%,#06020c_70%)] text-white"
    >
      <span className="perreo-burst flex flex-col items-center gap-4 text-center">
        <span className="perreo-glow grid size-28 place-items-center rounded-full bg-domain/25 text-domain">
          <Icon name="flame" className="size-16" />
        </span>
        <span className="font-display text-4xl font-extrabold tracking-wide uppercase">Modo Perreo</span>
        <span className="text-lg opacity-90">desbloqueado 🔥</span>
      </span>
    </button>
  )
}
