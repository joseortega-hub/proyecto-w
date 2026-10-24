import { useEffect, useRef,type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'
import type { VibeVariant } from '@/lib/vibe/vibe-spec'

const SEGMENTS = 12
const STEP = 0.05
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const snap = (n: number) => Math.round(clamp01(n) / STEP) * STEP

/** El ecualizador y los marcapáginas se arrastran en vertical; el HUD y la claqueta, en horizontal. */
export const isVerticalVibe = (variant: VibeVariant) => variant === 'eq' || variant === 'book'

/** Lleno sólido si es seguro; a puntos si es una suposición. */
const fillBackground = (solid: boolean): CSSProperties['background'] =>
  solid
    ? 'var(--primary)'
    : 'radial-gradient(circle, var(--primary) 1.6px, transparent 1.9px) 0 0 / 6px 6px, color-mix(in oklab, var(--primary) 16%, transparent)'

interface VibeSliderProps {
  label: string
  /** 0–1. */
  value: number
  /** Texto para lectores de pantalla ("Energía: muy tranquila"). */
  valueText: string
  variant: VibeVariant
  /** Seguro (relleno sólido) o supuesto (a puntos). */
  solid?: boolean
  disabled?: boolean
  /** Mientras se arrastra. */
  onChange?: (value: number) => void
  /** Al soltar (o tras pulsar una tecla): el valor final. */
  onCommit?: (value: number) => void
  className?: string
}

/**
 * Barra que se arrastra (puntero y táctil) o se mueve con flechas, Re Pág/Av Pág, Inicio y Fin.
 * Cuatro aspectos según la temática: ecualizador, HUD, claqueta y marcapáginas.
 */
export function VibeSlider({ label, value, valueText, variant, solid = true, disabled, onChange, onCommit, className }: VibeSliderProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const latest = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    latest.current = value
  }, [value])
  const vertical = isVerticalVibe(variant)

  const set = (v: number) => {
    const next = snap(v)
    latest.current = next
    onChange?.(next)
  }
  const fromPointer = (e: PointerEvent) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const raw = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width
    set(variant === 'eq' ? 1 - raw : raw)
  }
  const down = (e: PointerEvent) => {
    if (disabled) return
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    ref.current?.focus({ preventScroll: true })
    fromPointer(e)
  }
  const up = () => {
    if (!dragging.current) return
    dragging.current = false
    onCommit?.(latest.current)
  }
  const key = (e: KeyboardEvent) => {
    if (disabled) return
    const delta: Record<string, number> = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP, PageUp: 0.2, PageDown: -0.2 }
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : e.key in delta ? latest.current + delta[e.key] : null
    if (next === null) return
    e.preventDefault()
    set(next)
    // Varias pulsaciones seguidas valen como un solo ajuste.
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onCommit?.(latest.current), 600)
  }

  const on = Math.round(value * SEGMENTS)
  const background = fillBackground(solid)
  const track = cn('relative touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background', disabled ? 'cursor-wait opacity-70' : 'cursor-grab active:cursor-grabbing', className)

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      aria-valuetext={valueText}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-disabled={disabled}
      onPointerDown={down}
      onPointerMove={(e) => dragging.current && fromPointer(e)}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
      className={cn(
        track,
        variant === 'eq' && 'flex h-32 w-11 flex-col-reverse gap-[3px]',
        variant === 'hud' && 'flex h-7 w-full gap-[3px]',
        variant === 'cine' && 'h-8 w-full overflow-hidden border-2 border-foreground/60 bg-secondary',
        variant === 'book' && 'h-32 w-11 border-t-4 border-foreground/50 bg-secondary/60',
      )}
    >
      {(variant === 'eq' || variant === 'hud') &&
        Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            data-on={i < on}
            className={cn('flex-1 rounded-[3px] bg-secondary transition-colors', variant === 'hud' && '-skew-x-12 rounded-[2px]')}
            style={i < on ? { background } : undefined}
          />
        ))}
      {variant === 'eq' && <span aria-hidden className="vibe-cap pointer-events-none absolute inset-x-0 h-[3px] rounded bg-foreground" style={{ bottom: `calc(${value * 100}% - 1px)` }} />}
      {variant === 'cine' && (
        <>
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 transition-[width] duration-75"
            style={{ width: `${value * 100}%`, background, backgroundBlendMode: 'normal' }}
          />
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 opacity-35 mix-blend-multiply"
            style={{ width: `${value * 100}%`, background: 'repeating-linear-gradient(-45deg, var(--foreground) 0 7px, transparent 7px 14px)' }}
          />
          {(['top-[2px]', 'bottom-[2px]'] as const).map((pos) => (
            <span key={pos} aria-hidden className={cn('absolute inset-x-0 h-[3px] opacity-45', pos)} style={{ background: 'repeating-linear-gradient(90deg, var(--background) 0 5px, transparent 5px 11px)' }} />
          ))}
        </>
      )}
      {variant === 'book' && (
        <span
          aria-hidden
          className="absolute inset-x-1 top-0 transition-[height] duration-75"
          style={{
            height: `${Math.max(value, 0.1) * 100}%`,
            background,
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 12px), 0 100%)',
          }}
        />
      )}
    </div>
  )
}
