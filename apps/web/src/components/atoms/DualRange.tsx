import { cn } from '@/lib/utils'

interface DualRangeProps {
  min: number
  max: number
  low: number
  high: number
  labelLow: string
  labelHigh: string
  onChange: (low: number, high: number) => void
  className?: string
}

const thumb =
  'pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary focus-visible:outline-none [&::-webkit-slider-thumb]:focus-visible:ring-2 [&::-webkit-slider-thumb]:focus-visible:ring-ring'

/** Deslizador doble (mínimo y máximo). Son dos `input range` nativos: teclado, lectores de pantalla y táctil gratis. */
export function DualRange({ min, max, low, high, labelLow, labelHigh, onChange, className }: DualRangeProps) {
  const pct = (n: number) => ((n - min) / (max - min)) * 100
  return (
    <div className={cn('relative h-6 w-full touch-pan-y', className)}>
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-secondary" />
      <span aria-hidden className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary" style={{ left: `${pct(low)}%`, right: `${100 - pct(high)}%` }} />
      <input type="range" aria-label={labelLow} min={min} max={max} value={low} onChange={(e) => onChange(Math.min(Number(e.target.value), high), high)} className={thumb} />
      <input type="range" aria-label={labelHigh} min={min} max={max} value={high} onChange={(e) => onChange(low, Math.max(Number(e.target.value), low))} className={thumb} />
    </div>
  )
}
