import { useId } from 'react'
import { cn } from '@/lib/utils'

interface FameSliderProps {
  min: number
  max: number
  onChange: (range: { min: number; max: number }) => void
  className?: string
}

/** Rango de fama de «underground» a «mainstream»: dos deslizadores que nunca se cruzan. */
export function FameSlider({ min, max, onChange, className }: FameSliderProps) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex justify-between text-xs font-bold text-muted-foreground">
        <span>Underground</span>
        <span className="font-mono tabular-nums">
          {min}–{max}
        </span>
        <span>Mainstream</span>
      </div>
      <div className="relative h-11">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-secondary" />
        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-domain" style={{ left: `${min}%`, right: `${100 - max}%` }} />
        {(['min', 'max'] as const).map((which) => (
          <input
            key={which}
            id={`${id}-${which}`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={which === 'min' ? min : max}
            aria-label={which === 'min' ? 'Fama mínima' : 'Fama máxima'}
            onChange={(e) => {
              const v = Number(e.target.value)
              onChange(which === 'min' ? { min: Math.min(v, max), max } : { min, max: Math.max(v, min) })
            }}
            className="pointer-events-none absolute inset-0 size-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-card [&::-moz-range-thumb]:bg-domain [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-card [&::-webkit-slider-thumb]:bg-domain [&::-webkit-slider-thumb]:shadow-md"
          />
        ))}
      </div>
    </div>
  )
}
