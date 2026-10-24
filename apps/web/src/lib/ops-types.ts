export interface SkippedProvider {
  provider: string
  reason: string
  ms: number
}

export interface TraceRow {
  id: string
  at: string
  task: string
  subject: string
  provider: string | null
  model: string | null
  ok: boolean
  skipped: SkippedProvider[]
  latencyMs: number
  totalMs: number
  inputTokens: number | null
  outputTokens: number | null
  listCostEur: number
  free: boolean
  outcome: string | null
}

export interface ProviderStats {
  provider: string
  calls: number
  medianMs: number
  p95Ms: number
}

export interface TraceSummary {
  calls: number
  failed: number
  fallbackPct: number
  medianMs: number
  p95Ms: number
  byProvider: ProviderStats[]
  listCostEur: number
  paidEur: number
  inputTokens: number
  outputTokens: number
}

export interface OpsPanel {
  sessionId: string | null
  rows: TraceRow[]
  summary: TraceSummary
  global: TraceSummary
  providers: string[]
  cooldown: { compare: number; judge: number }
  canCompare: boolean
}

export interface CompareRowData {
  provider: string
  ok: boolean
  choice: string | null
  label: string | null
  confidence: number | null
  latencyMs: number
  agrees: boolean | null
  error: string | null
}

export interface CompareResult {
  rows: CompareRowData[]
  question: string
}

export interface Judgement {
  score: number
  reason: string
  judge: string
}
