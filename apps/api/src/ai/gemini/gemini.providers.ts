import { Logger } from '@nestjs/common';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { embedMany, experimental_decide, generateText, Output } from 'ai';
import type { z } from 'zod';
import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from '../decision-provider.js';
import type { EmbeddingProvider } from '../embedding-provider.js';
import type { TextProvider } from '../text-provider.js';

/**
 * El plan gratuito a veces se satura (503 "high demand") o se queda colgado. En vez de
 * reintentar el mismo modelo, se falla rápido y se pasa al siguiente de la cadena.
 * El modelo que falla queda apartado unos minutos ("cortacircuitos"): así las llamadas
 * siguientes no vuelven a esperar a que se agote su timeout.
 */
const CALL_TIMEOUT_MS = 12_000;
const COOLDOWN_MS = 3 * 60_000;
const logger = new Logger('Gemini');
const cooldownUntil = new Map<string, number>();

export const isTransient = (error: unknown) =>
  (error as Error)?.name === 'TimeoutError' ||
  /high demand|overloaded|unavailable|resource.?exhausted|quota|rate limit|timeout|aborted|\b(429|500|503)\b/i.test(
    String((error as Error)?.message ?? error),
  );

/** Modelos disponibles primero (en su orden); los apartados, al final, por si fallan todos. */
export function modelOrder(models: string[], now = Date.now()): string[] {
  const ready = models.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
  const cooling = models
    .filter((m) => (cooldownUntil.get(m) ?? 0) > now)
    .sort((a, b) => cooldownUntil.get(a)! - cooldownUntil.get(b)!);
  return [...ready, ...cooling];
}

/** Aparta un modelo hasta `until` (lo usa `withModelFallback` y los tests). */
export function coolDown(model: string, until = Date.now() + COOLDOWN_MS) {
  cooldownUntil.set(model, until);
}

async function withModelFallback<T>(models: string[], call: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const model of modelOrder(models)) {
    try {
      const result = await call(model);
      cooldownUntil.delete(model);
      return result;
    } catch (error) {
      if (!isTransient(error)) throw error;
      lastError = error;
      coolDown(model);
      logger.warn(`${model} no disponible (${(error as Error).message?.slice(0, 80)}); lo aparto unos minutos`);
    }
  }
  throw lastError;
}

export function createGemini(apiKey: string) {
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en .env');
  return createGoogleGenerativeAI({ apiKey });
}

/**
 * Decisiones con Gemini a través de `experimental_decide` del AI SDK, que adapta
 * la salida estructurada del modelo a preguntas choice/score/boolean.
 */
export class GeminiDecisionProvider implements DecisionProvider {
  readonly name: string;

  constructor(
    private readonly google: GoogleGenerativeAIProvider,
    /** El primero es el preferido; los demás, el respaldo si está saturado. */
    private readonly models: string[],
  ) {
    this.name = `gemini:${models[0]}`;
  }

  async decide<Q extends Record<string, DecisionQuestion>>(state: string | Record<string, unknown>, questions: Q) {
    const { answers } = await withModelFallback(this.models, (model) =>
      experimental_decide({
        model: this.google.decisionModel(model),
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        state: state as Parameters<typeof experimental_decide>[0]['state'],
        questions: Object.fromEntries(
          Object.entries(questions).map(([id, q]) => [id, q.type === 'noul' ? { type: 'boolean', instructions: q.instructions } : q]),
        ),
      }),
    );

    const out: Record<string, DecisionAnswer> = {};
    for (const [id, q] of Object.entries(questions)) {
      const a = answers[id];
      if (q.type === 'choice' && a.type === 'choice') {
        out[id] = { type: 'choice', choice: a.choice, confidence: a.probabilities?.[a.choice] ?? null };
      } else if (q.type === 'score' && a.type === 'score') {
        out[id] = { type: 'score', score: a.score / (q.criteria.length - 1) };
      } else if (q.type === 'noul' && a.type === 'boolean') {
        out[id] = { type: 'noul', probability: a.probability };
      } else {
        throw new Error(`Respuesta inesperada para "${id}": ${a.type}`);
      }
    }
    return out as never;
  }
}

export class GeminiTextProvider implements TextProvider {
  readonly name: string;

  constructor(
    private readonly google: GoogleGenerativeAIProvider,
    /** El primero es el preferido; los demás, el respaldo si está saturado. */
    private readonly models: string[],
  ) {
    this.name = `gemini:${models[0]}`;
  }

  async write<S extends z.ZodType>({ system, prompt, schema }: { system: string; prompt: string; schema: S }) {
    const { output } = await withModelFallback(this.models, (model) =>
      generateText({
        model: this.google(model),
        system,
        prompt,
        output: Output.object({ schema }),
        reasoning: 'none',
        maxRetries: 0,
        // Los textos largos (explicaciones de toda la lista) necesitan algo más de margen.
        timeout: CALL_TIMEOUT_MS * 1.5,
      }),
    );
    return output as z.infer<S>;
  }
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly dimensions = 768;

  constructor(
    private readonly google: GoogleGenerativeAIProvider,
    private readonly model: string,
  ) {
    this.name = `gemini:${model}`;
  }

  async embed(texts: string[], purpose: 'document' | 'query'): Promise<number[][]> {
    const { embeddings } = await embedMany({
      model: this.google.embeddingModel(this.model),
      values: texts,
      providerOptions: {
        google: {
          outputDimensionality: this.dimensions,
          taskType: purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
        },
      },
    });
    return embeddings;
  }
}
