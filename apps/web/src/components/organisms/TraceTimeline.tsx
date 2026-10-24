import { Text } from '@/components/atoms'
import { TraceStep } from '@/components/molecules'
import type { TraceRow } from '@/lib/ops-types'

/** Línea de tiempo de las llamadas de IA de una entrevista, de la primera a la última. */
export function TraceTimeline({ rows, compact }: { rows: TraceRow[]; compact?: boolean }) {
  if (!rows.length) {
    return (
      <Text size="sm" tone="muted">
        Aún no hay llamadas de IA registradas en esta entrevista.
      </Text>
    )
  }
  return (
    <ol className="flex flex-col gap-2" aria-label="Línea de tiempo de la IA">
      {rows.map((row) => (
        <TraceStep key={row.id} row={row} compact={compact} />
      ))}
    </ol>
  )
}
