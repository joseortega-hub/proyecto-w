import { Logger } from '@nestjs/common';
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { embedMany, experimental_decide, generateText, Output } from 'ai';
import type { z } from 'zod';
import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from '../decision-provider.js';
import type { EmbeddingProvider } from '../embedding-provider.js';
import { withModelFallback } from '../model-fallback.js';
import type { TextProvider } from '../text-provider.js';

/** Si un modelo no responde en este tiempo, se pasa al siguiente de la cadena. */
const CALL_TIMEOUT_MS = 12_000;
const logger = new Logger('Gemini');

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
    const { answers } = await withModelFallback(
      this.models,
      (model) =>
        experimental_decide({
          model: this.google.decisionModel(model),
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
          state: state as Parameters<typeof experimental_decide>[0]['state'],
          questions: Object.fromEntries(
            Object.entries(questions).map(([id, q]) => [id, q.type === 'noul' ? { type: 'boolean', instructions: q.instructions } : q]),
          ),
        }),
      logger,
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
    const { output } = await withModelFallback(
      this.models,
      (model) =>
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
      logger,
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
