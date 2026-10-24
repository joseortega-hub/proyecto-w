import { AsyncLocalStorage } from 'node:async_hooks';

/** Por qué se saltó un proveedor de la cadena. */
export type SkipReason = 'sin cupo' | 'saturado' | 'timeout' | 'JSON mal formado' | 'caído' | 'error';

export interface SkippedProvider {
  provider: string;
  reason: SkipReason;
  ms: number;
}

/**
 * Una llamada de IA, solo con metadatos. Privacidad: nunca lleva el texto de la persona ni
 * el `state` de la decisión; `subject` son ids de preguntas y `outcome` la opción elegida.
 */
export interface TraceEvent {
  sessionId: string | null;
  /** `choice`, `score`, `noul` (o varias unidas con +), `text` o `embedding`. */
  task: string;
  subject: string;
  /** Proveedor que respondió (null si fallaron todos). */
  provider: string | null;
  model: string | null;
  ok: boolean;
  skipped: SkippedProvider[];
  latencyMs: number;
  totalMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  outcome: string | null;
}

const requestStore = new AsyncLocalStorage<{ sessionId?: string }>();
/** Ejecuta `fn` marcando a qué sesión de entrevista pertenecen las llamadas de IA que haga. */
export const runInTrace = <T>(context: { sessionId?: string }, fn: () => T): T => requestStore.run(context, fn);
export const currentSession = () => requestStore.getStore()?.sessionId;

interface AttemptUsage {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}
const attemptStore = new AsyncLocalStorage<AttemptUsage>();

/** Ejecuta un intento de proveedor recogiendo los tokens y el modelo que declare con `noteUsage`. */
export async function withAttempt<T>(fn: () => Promise<T>): Promise<{ result: T; usage: AttemptUsage }> {
  const usage: AttemptUsage = {};
  const result = await attemptStore.run(usage, fn);
  return { result, usage };
}

/** Los proveedores llaman aquí con el uso que da el SDK, si lo da. */
export function noteUsage(usage: { inputTokens?: number; outputTokens?: number } | undefined, model?: string) {
  const store = attemptStore.getStore();
  if (!store) return;
  if (usage?.inputTokens != null) store.inputTokens = usage.inputTokens;
  if (usage?.outputTokens != null) store.outputTokens = usage.outputTokens;
  if (model) store.model = model;
}

let sink: ((event: TraceEvent) => void) | null = null;
export const setTraceSink = (next: ((event: TraceEvent) => void) | null) => {
  sink = next;
};
export function emitTrace(event: TraceEvent) {
  try {
    sink?.(event);
  } catch {
    // Las trazas nunca deben romper una llamada de IA.
  }
}

export function skipReason(error: unknown): SkipReason {
  const text = String((error as Error)?.message ?? error);
  if (['TimeoutError', 'AbortError'].includes((error as Error)?.name) || /timeout|timed out|aborted/i.test(text)) return 'timeout';
  if (/quota|rate.?limit|resource.?exhausted|\b429\b|insufficient|credit/i.test(text)) return 'sin cupo';
  if (/failed to generate|no object generated|(does|did) not match|could not parse|invalid json/i.test(text)) return 'JSON mal formado';
  if (/high demand|overloaded|unavailable|\b(500|502|503)\b/i.test(text)) return 'saturado';
  if (/fetch failed|econnrefused|econnreset|connection|no está cargado/i.test(text)) return 'caído';
  return 'error';
}
