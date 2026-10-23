import { TypeSafeClient } from '@typesafe-ai/sdk';
import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from '../decision-provider.js';

/**
 * Jev (TypeSafe AI): decisiones nativas con probabilidades calibradas.
 * Se activa con DECISION_PROVIDER=jev y TYPESAFE_API_KEY en .env.
 */
export class JevDecisionProvider implements DecisionProvider {
  readonly name: string;
  private readonly client: TypeSafeClient;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    if (!apiKey) throw new Error('Falta TYPESAFE_API_KEY en .env');
    this.client = new TypeSafeClient({ apiKey });
    this.name = `jev:${model}`;
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
        throw new Error(`Respuesta inesperada de Jev para "${id}": ${a.type}`);
      }
    }
    return out as never;
  }
}
