import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { embedMany, experimental_decide, generateText, Output } from 'ai';
import type { z } from 'zod';
import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from '../decision-provider.js';
import type { EmbeddingProvider } from '../embedding-provider.js';
import type { TextProvider } from '../text-provider.js';

/** El plan gratuito a veces se queda colgado: mejor fallar rápido y reintentar una vez. */
const CALL_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 1;

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
    private readonly model: string,
  ) {
    this.name = `gemini:${model}`;
  }

  async decide<Q extends Record<string, DecisionQuestion>>(state: string | Record<string, unknown>, questions: Q) {
    const { answers } = await experimental_decide({
      model: this.google.decisionModel(this.model),
      maxRetries: MAX_RETRIES,
      abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS * (MAX_RETRIES + 1)),
      state: state as Parameters<typeof experimental_decide>[0]['state'],
      questions: Object.fromEntries(
        Object.entries(questions).map(([id, q]) => [id, q.type === 'noul' ? { type: 'boolean', instructions: q.instructions } : q]),
      ),
    });

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
    private readonly model: string,
  ) {
    this.name = `gemini:${model}`;
  }

  async write<S extends z.ZodType>({ system, prompt, schema }: { system: string; prompt: string; schema: S }) {
    const { output } = await generateText({
      model: this.google(this.model),
      system,
      prompt,
      output: Output.object({ schema }),
      reasoning: 'none',
      maxRetries: MAX_RETRIES,
      timeout: CALL_TIMEOUT_MS,
    });
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
