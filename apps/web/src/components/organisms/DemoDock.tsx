import { useEffect, useRef } from 'react'
import { Icon, Text } from '@/components/atoms'
import { TraceStep } from '@/components/molecules'
import type { TraceRow } from '@/lib/ops-types'

/**
 * Modo demo: decisiones de la IA en directo durante la entrevista. Panel lateral en
 * escritorio y franja inferior (se desliza) en móvil.
 */
export function DemoDock({ rows, onClose }: { rows: TraceRow[]; onClose: () => void }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' })
  }, [rows.length])
  return (
    <aside
      aria-label="Modo demo: la IA en directo"
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[34dvh] flex-col gap-2 rounded-t-xl border-t border-border bg-card/95 p-3 shadow-lg backdrop-blur md:inset-x-auto md:top-4 md:right-4 md:bottom-4 md:max-h-none md:w-80 md:rounded-xl md:border"
    >
      <div className="flex items-center justify-between">
        <Text font="label" className="inline-flex items-center gap-1.5">
          <Icon name="activity" className="size-4" /> Bajo el capó · en vivo
        </Text>
        <button type="button" onClick={onClose} className="rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
          Ocultar
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <Text size="sm" tone="muted">
            Esperando la primera decisión…
          </Text>
        ) : (
          <ol className="flex flex-col gap-2">
            {rows.slice(-12).map((row) => (
              <TraceStep key={row.id} row={row} compact />
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>
    </aside>
  )
}
