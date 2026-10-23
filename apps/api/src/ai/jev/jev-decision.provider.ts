import { TypeSafeClient } from '@typesafe-ai/sdk';
import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from '../decision-provider.js';

export interface JevOptions {
  apiKey: string;
  model: string;
  /** Raíz de la API; por defecto la de TypeSafe. Ollaya (Laya en local) habla el mismo protocolo. */
  baseURL?: string;
  /** Tiempo máximo por llamada, en ms. */
  timeoutMs?: number;
  /** Reintentos de la SDK; con una cadena de respaldo conviene 0 y saltar al siguiente. */
  maxRetries?: number;
  /** Prefijo del nombre en logs y en la vista de la sesión. */
  label?: string;
  /** La SDK comprime con zstd los cuerpos de más de 1 KiB; Ollaya no lo admite. */
  compression?: false;
}

/**
 * Jev (TypeSafe AI): decisiones nativas con probabilidades calibradas.
 * Se activa con DECISION_PROVIDER=jev y TYPESAFE_API_KEY en .env. Con otra `baseURL`
 * sirve también para cualquier servidor compatible, como Ollaya con Laya.
 */
export class JevDecisionProvider implements DecisionProvider {
  readonly name: string;
  private readonly client: TypeSafeClient;
  private readonly model: string;

  constructor({ apiKey, model, baseURL, timeoutMs, maxRetries, label = 'jev', compression }: JevOptions) {
    if (!apiKey) throw new Error('Falta TYPESAFE_API_KEY en .env');
    this.client = new TypeSafeClient({
      apiKey,
      baseURL,
      timeout: timeoutMs,
      retry: maxRetries === undefined ? undefined : { maxRetries },
      compression,
    });
    this.model = model;
    this.name = `${label}:${model}`;
  }

  async decide<Q extends Record<string, DecisionQuestion>>(state: string | Record<string, unknown>, questions: Q) {
    const { answers } = await this.client.systemOne({
      state: state as never,
      model: this.model,
      questions: Object.fromEntries(Object.entries(questions).map(([id, q]) => [id, q])) as never,
    });

    const out: Record<string, DecisionAnswer> = {};
    for (const [id, q] of Object.entries(questions)) {
      const a = (answers as Record<string, { type: string } & Record<string, unknown>>)[id];
      if (a.type === 'choice') {
        out[id] = { type: 'choice', choice: a.choice as string, confidence: a.confidence as number };
      } else if (a.type === 'score' && q.type === 'score') {
        out[id] = { type: 'score', score: (a.score as number) / (q.criteria.length - 1) };
      } else if (a.type === 'noul') {
        out[id] = { type: 'noul', probability: a.noul as number };
      } else {
        throw new Error(`Respuesta inesperada de ${this.name} para "${id}": ${a.type}`);
      }
    }
    return out as never;
  }
}
