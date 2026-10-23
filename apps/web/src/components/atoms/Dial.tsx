import { cn } from '@/lib/utils'

/**
 * Dial de confianza: una regla con marcas y una aguja naranja que avanza
 * a medida que la entrevista conoce mejor a la persona.
 */
export function Dial({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="meter"
      aria-label="Confianza del perfil"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn(
        'relative h-[18px] rounded-[3px] bg-[repeating-linear-gradient(90deg,var(--border)_0_2px,transparent_2px_9px)]',
        className,
      )}
    >
      <span
        className="absolute -top-[3px] -bottom-[3px] w-1 -translate-x-1/2 rounded-[2px] bg-signal transition-[left] duration-200 ease-standard"
        style={{ left: `${pct}%` }}
      />
    </div>
  )
}
