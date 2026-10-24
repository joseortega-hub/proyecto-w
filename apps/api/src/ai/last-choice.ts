import type { DecisionQuestion } from './decision-provider.js';

/**
 * Última decisión `choice` de cada entrevista, solo en memoria y unos minutos: la
 * comparativa de proveedores la relanza tal cual. Lleva el estado (puede incluir texto de la
 * persona), por eso NO se guarda en la base de datos y caduca pronto.
 */
export interface LastChoice {
  state: string | Record<string, unknown>;
  questions: Record<string, DecisionQuestion>;
  /** Opción que eligió la cadena, por pregunta. */
  chosen: Record<string, { choice: string; confidence: number | null }>;
  at: number;
}

const TTL_MS = 15 * 60_000;
const MAX = 100;
const store = new Map<string, LastChoice>();

export function rememberChoice(sessionId: string, entry: Omit<LastChoice, 'at'>, now = Date.now()) {
  store.delete(sessionId);
  store.set(sessionId, { ...entry, at: now });
  for (const [id, e] of store) if (now - e.at > TTL_MS) store.delete(id);
  while (store.size > MAX) store.delete(store.keys().next().value!);
}

export function lastChoice(sessionId: string, now = Date.now()): LastChoice | null {
  const entry = store.get(sessionId);
  return entry && now - entry.at <= TTL_MS ? entry : null;
}
