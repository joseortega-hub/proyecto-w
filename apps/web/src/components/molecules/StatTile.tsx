import { Text } from '@/components/atoms'
import { cn } from '@/lib/utils'

/** Una cifra con su etiqueta (resumen del panel). */
export function StatTile({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-card p-3', className)}>
      <Text font="label">
        {label}
      </Text>
      <Text font="mono" className="text-xl font-bold">
        {value}
      </Text>
      {hint && (
        <Text size="xs" tone="muted">
          {hint}
        </Text>
      )}
    </div>
  )
}
