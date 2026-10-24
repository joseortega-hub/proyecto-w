import { Button, ProviderChip, Spinner, Text } from '@/components/atoms'
import { formatMs } from '@/lib/ops-format'
import type { CompareResult } from '@/lib/ops-types'

interface ProviderCompareProps {
  result: CompareResult | null
  running: boolean
  /** Segundos que faltan para poder volver a comparar (límite de una cada 30 s). */
  waitSec: number
  /** Sin decisión reciente de la entrevista no hay nada que comparar. */
  disabled?: boolean
  error?: string | null
  onRun: () => void
}

/** Comparativa bajo demanda: la misma decisión real, lanzada a todos los proveedores a la vez. */
export function ProviderCompare({ result, running, waitSec, disabled, error, onRun }: ProviderCompareProps) {
  return (
    <section aria-label="Comparar proveedores" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="md" onClick={onRun} disabled={running || disabled || waitSec > 0}>
          {running && <Spinner className="size-4" />}
          {running ? 'Comparando…' : waitSec > 0 ? `Comparar de nuevo en ${waitSec} s` : 'Comparar proveedores'}
        </Button>
        <Text size="xs" tone="muted" className="max-w-xs">
          Lanza la última decisión real de la entrevista a todos los proveedores. Gasta cupo: máximo una cada 30 s.
        </Text>
      </div>
      {disabled && !result && (
        <Text size="sm" tone="muted">
          Responde alguna pregunta de una entrevista y vuelve aquí.
        </Text>
      )}
      {error && (
        <Text size="sm" className="text-destructive" role="alert">
          {error}
        </Text>
      )}
      {result && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-secondary text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-bold">Proveedor</th>
                <th className="px-3 py-2 font-bold">Respuesta</th>
                <th className="px-3 py-2 font-bold">Confianza</th>
                <th className="px-3 py-2 font-bold">Latencia</th>
                <th className="px-3 py-2 font-bold">¿Coincide?</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.provider} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <ProviderChip provider={r.provider} failed={!r.ok} />
                  </td>
                  <td className="px-3 py-2">
                    {r.ok ? <span className="line-clamp-2">{r.label ?? r.choice}</span> : <span className="text-muted-foreground">✗ {r.error}</span>}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">{r.confidence != null ? `${Math.round(r.confidence * 100)} %` : '—'}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{formatMs(r.latencyMs)}</td>
                  <td className="px-3 py-2 font-bold">{r.agrees == null ? '—' : r.agrees ? '✓ sí' : '✗ no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
