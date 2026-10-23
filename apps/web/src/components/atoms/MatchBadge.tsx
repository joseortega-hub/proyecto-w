import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** Porcentaje de encaje. Es el único sitio donde se usa el naranja de señal. */
export function MatchBadge({ value, className }: { value: number; className?: string }) {
  return (
    <Badge
      aria-label={`Encaje del ${value} %`}
      className={cn('rounded-full border-transparent bg-signal-muted px-2.5 py-0.5 font-mono text-[13px] font-semibold tabular-nums text-signal-foreground', className)}
    >
      {value} %
    </Badge>
  )
}
