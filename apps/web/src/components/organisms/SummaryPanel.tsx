import { ProviderChip, Text } from '@/components/atoms'
import { StatTile } from '@/components/molecules'
import { formatEur, formatMs } from '@/lib/ops-format'
import type { TraceSummary } from '@/lib/ops-types'

/** Llamadas por proveedor, latencia mediana y p95, % de respaldos y coste total estimado. */
export function SummaryPanel({ summary }: { summary: TraceSummary }) {
  const cost =
    summary.paidEur > 0
      ? { value: formatEur(summary.paidEur), hint: `a precios de lista: ${formatEur(summary.listCostEur)}` }
      : { value: '0 €', hint: summary.listCostEur > 0 ? `gratis · equivaldría a ${formatEur(summary.listCostEur)}` : 'gratis · sin tokens que contar' }
  const max = Math.max(1, ...summary.byProvider.map((p) => p.calls))
  return (
    <section aria-label="Resumen" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatTile label="Llamadas" value={String(summary.calls)} hint={summary.failed ? `${summary.failed} sin respuesta` : undefined} />
        <StatTile label="Mediana" value={formatMs(summary.medianMs)} hint={`p95: ${formatMs(summary.p95Ms)}`} />
        <StatTile label="Con respaldo" value={`${summary.fallbackPct} %`} hint="saltaron de proveedor" />
        <StatTile label="Coste" value={cost.value} hint={cost.hint} />
      </div>
      {summary.cacheHits > 0 && (
        <Text size="sm" tone="muted">
          Caché ✓ {summary.cacheHits} {summary.cacheHits === 1 ? 'respuesta' : 'respuestas'} ({summary.cacheHitPct} %) sin gastar cupo · ahorro: {summary.savedTokens.toLocaleString('es-ES')} tokens
          {summary.savedEur > 0 ? ` (${formatEur(summary.savedEur)} a precio de lista)` : ''}
        </Text>
      )}
      {summary.byProvider.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Llamadas por proveedor">
          {summary.byProvider.map((p) => (
            <li key={p.provider} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
              <ProviderChip provider={p.provider} />
              <span className="h-2 rounded-full bg-secondary" aria-hidden>
                <span className="block h-full rounded-full bg-domain" style={{ width: `${(p.calls / max) * 100}%` }} />
              </span>
              <Text size="xs" font="mono" tone="muted" className="text-right">
                {p.calls} · {formatMs(p.medianMs)} · p95 {formatMs(p.p95Ms)}
              </Text>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
