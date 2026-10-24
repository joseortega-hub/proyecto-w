import { Meter, Text } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface CountBarsProps {
  items: { label: string; count: number }[]
  /** Qué cuenta cada número, para el lector de pantalla («veces»). */
  unit?: string
  className?: string
}

/** Lista de etiquetas con una barra proporcional al número (lo más frecuente primero). */
export function CountBars({ items, unit = 'veces', className }: CountBarsProps) {
  const max = Math.max(1, ...items.map((i) => i.count))
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <Text size="sm" className="min-w-0 truncate font-bold">
              {i.label}
            </Text>
            <Text font="mono" size="xs" tone="muted" className="flex-none">
              {i.count}
              <span className="sr-only"> {unit}</span>
            </Text>
          </div>
          <Meter value={i.count / max} label={`${i.label}: ${i.count} ${unit}`} className="[&>[data-slot=progress-indicator]]:bg-domain" />
        </li>
      ))}
    </ul>
  )
}
