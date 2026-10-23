import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

/** Barra de valor 0–1 (atributos del perfil). */
export function Meter({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <Progress
      aria-label={label}
      value={Math.round(value * 100)}
      className={cn('h-2 bg-secondary [&>[data-slot=progress-indicator]]:bg-primary', className)}
    />
  )
}
