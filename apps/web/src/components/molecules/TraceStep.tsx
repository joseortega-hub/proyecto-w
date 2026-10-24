import { ProviderChip, Text } from '@/components/atoms'
import { formatEur, formatMs, taskName } from '@/lib/ops-format'
import type { TraceRow } from '@/lib/ops-types'
import { cn } from '@/lib/utils'

/** Un paso de la línea de tiempo: la tarea, quién respondió y la cadena de respaldo si la hubo. */
export function TraceStep({ row, compact, className }: { row: TraceRow; compact?: boolean; className?: string }) {
  const tokens = row.inputTokens != null || row.outputTokens != null ? `${row.inputTokens ?? 0}→${row.outputTokens ?? 0} tok` : null
  return (
    <li className={cn('flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Text size="sm" className="font-bold">
          {taskName(row.task)}
          {!compact && row.outcome && (
            <Text as="span" size="xs" tone="muted" font="mono" className="ml-2 font-normal">
              → {row.outcome}
            </Text>
          )}
        </Text>
        <Text as="span" size="xs" tone="muted" font="mono">
          {new Date(row.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Cadena de respaldo">
        {row.skipped.map((s) => (
          <span key={s.provider + s.ms} className="inline-flex items-center gap-1.5">
            <ProviderChip provider={s.provider} failed />
            <Text as="span" size="xs" tone="muted">
              ✗ {s.reason}
            </Text>
            <Text as="span" size="xs" tone="muted" aria-hidden>
              →
            </Text>
          </span>
        ))}
        {row.ok && row.provider ? (
          <>
            <ProviderChip provider={row.provider} />
            <Text as="span" size="sm" font="mono" className="font-bold">
              ✓ {formatMs(row.latencyMs)}
            </Text>
          </>
        ) : (
          <Text as="span" size="sm" className="font-bold text-destructive">
            ✗ fallaron todos ({formatMs(row.totalMs)})
          </Text>
        )}
      </div>
      {!compact && (
        <Text size="xs" tone="muted" font="mono" className="break-words">
          {[row.model, tokens, row.free ? (row.listCostEur > 0 ? `0 € (gratis) · equivaldría a ${formatEur(row.listCostEur)}` : '0 € (gratis)') : formatEur(row.listCostEur)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}
    </li>
  )
}
