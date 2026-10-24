export interface TraceView {
  id: string;
  at: string;
  task: string;
  subject: string;
  provider: string | null;
  model: string | null;
  ok: boolean;
  skipped: { provider: string; reason: string; ms: number }[];
  latencyMs: number;
  totalMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  listCostEur: number;
  free: boolean;
  outcome: string | null;
}

export interface ProviderStats {
  provider: string;
  calls: number;
  medianMs: number;
  p95Ms: number;
}

export interface TraceSummary {
  calls: number;
  failed: number;
  /** % de llamadas que necesitaron saltar a otro proveedor. */
  fallbackPct: number;
  medianMs: number;
  p95Ms: number;
  byProvider: ProviderStats[];
  /** Lo que habría costado a precios de lista (en el plan gratuito se paga 0 €). */
  listCostEur: number;
  paidEur: number;
  inputTokens: number;
  outputTokens: number;
}

/** Percentil por rango más cercano: robusto con pocas muestras. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

export function summarize(rows: TraceView[]): TraceSummary {
  const answered = rows.filter((r) => r.ok && r.provider);
  const groups = new Map<string, number[]>();
  for (const r of answered) groups.set(r.provider!, [...(groups.get(r.provider!) ?? []), r.latencyMs]);
  const latencies = answered.map((r) => r.latencyMs);
  return {
    calls: rows.length,
    failed: rows.length - answered.length,
    fallbackPct: rows.length ? Math.round((rows.filter((r) => r.skipped.length > 0).length / rows.length) * 100) : 0,
    medianMs: percentile(latencies, 50),
    p95Ms: percentile(latencies, 95),
    byProvider: [...groups]
      .map(([provider, ms]) => ({ provider, calls: ms.length, medianMs: percentile(ms, 50), p95Ms: percentile(ms, 95) }))
      .sort((a, b) => b.calls - a.calls),
    listCostEur: rows.reduce((sum, r) => sum + r.listCostEur, 0),
    paidEur: rows.filter((r) => !r.free).reduce((sum, r) => sum + r.listCostEur, 0),
    inputTokens: rows.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0),
    outputTokens: rows.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0),
  };
}
