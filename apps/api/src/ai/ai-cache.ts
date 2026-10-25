import { createHash } from 'node:crypto';
import { z } from 'zod';

/**
 * Caché de respuestas de IA. La clave es un hash de la tarea + el esquema + el estado
 * normalizado: el texto de la persona solo entra dentro del hash, nunca en claro. Se guardan
 * solo respuestas que dio un proveedor de verdad (los respaldos sin IA no pasan por aquí).
 * Va primero en memoria (~1 ms) y, si hay almacén, también en la BD (sobrevive a reinicios
 * y al sueño de Render).
 */
export interface CachedAnswer {
  value: unknown;
  /** Quién respondió la primera vez: "groq" y "openai/gpt-oss-120b". Sirve para estimar el ahorro. */
  provider: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiCacheStore {
  get(key: string): Promise<CachedAnswer | null>;
  set(key: string, answer: CachedAnswer, ttlMs: number, kind: string): Promise<void>;
}

const DAY_MS = 24 * 60 * 60_000;
const MEMORY_MAX = 300;

export const cacheSettings = {
  /** `AI_CACHE=off` la apaga del todo. */
  enabled: (process.env.AI_CACHE ?? 'on').trim().toLowerCase() !== 'off',
  /** Decisiones: 7 días por defecto (AI_CACHE_DECISION_TTL_H). */
  decisionTtlMs: Number(process.env.AI_CACHE_DECISION_TTL_H ?? 24 * 7) * 60 * 60_000 || 7 * DAY_MS,
  /** Texto: 24 h por defecto (AI_CACHE_TEXT_TTL_H). */
  textTtlMs: Number(process.env.AI_CACHE_TEXT_TTL_H ?? 24) * 60 * 60_000 || DAY_MS,
};

/** JSON con las claves ordenadas, para que el mismo estado dé siempre el mismo hash. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const hash = (payload: unknown) => createHash('sha256').update(stableStringify(payload)).digest('hex');

export const decisionKey = (state: unknown, questions: unknown) => `d:${hash({ v: 1, state, questions })}`;

export function textKey(request: { system: string; prompt: string; schema: z.ZodType }) {
  let schema: unknown = 'sin-esquema';
  try {
    schema = z.toJSONSchema(request.schema);
  } catch {
    // Esquemas que no se pueden pasar a JSON Schema: se identifican solo por system + prompt.
  }
  return `t:${hash({ v: 1, system: request.system, prompt: request.prompt, schema })}`;
}

let store: AiCacheStore | null = null;
const memory = new Map<string, { answer: CachedAnswer; expires: number }>();

export const setAiCacheStore = (next: AiCacheStore | null) => {
  store = next;
};
export const clearAiCacheMemory = () => memory.clear();

export async function cacheGet(key: string, now = Date.now()): Promise<CachedAnswer | null> {
  if (!cacheSettings.enabled) return null;
  const hit = memory.get(key);
  if (hit && hit.expires > now) return hit.answer;
  memory.delete(key);
  try {
    const answer = (await store?.get(key)) ?? null;
    if (answer) remember(key, answer, now + 60 * 60_000);
    return answer;
  } catch {
    return null; // la caché nunca debe romper una llamada
  }
}

export async function cacheSet(key: string, answer: CachedAnswer, ttlMs: number, kind: string, now = Date.now()) {
  if (!cacheSettings.enabled) return;
  remember(key, answer, now + Math.min(ttlMs, 60 * 60_000));
  try {
    await store?.set(key, answer, ttlMs, kind);
  } catch {
    // idem
  }
}

function remember(key: string, answer: CachedAnswer, expires: number) {
  memory.delete(key);
  memory.set(key, { answer, expires });
  while (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value!);
}
