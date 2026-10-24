import { cn } from '@/lib/utils'

interface VibeDotProps {
  /** Degradado OKLCH de la vibra; sin él, la celda está vacía. */
  gradient?: string | null
  /** Lo que lee el lector de pantalla y el tooltip: «sábado 24 · Lluvia y cascos puestos». */
  label: string
  /** Un día futuro del calendario: ni se pinta. */
  hidden?: boolean
  className?: string
}

/** Celda del calendario de vibras: cuadrada, con el color de la vibra de ese día. */
export function VibeDot({ gradient, label, hidden, className }: VibeDotProps) {
  if (hidden) return <span aria-hidden className={cn('aspect-square', className)} />
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={gradient ? { backgroundImage: gradient } : undefined}
      className={cn('aspect-square rounded-[3px] md:rounded-[4px]', gradient ? 'shadow-sm' : 'bg-secondary', className)}
    />
  )
}
