import { Logger } from '@nestjs/common';
import type { DecisionProvider, DecisionQuestion } from './decision-provider.js';

/** Usa el proveedor principal y, si falla, repite la decisión con el de respaldo. */
export class FallbackDecisionProvider implements DecisionProvider {
  readonly name: string;
  private readonly logger = new Logger('Decisiones');

  constructor(
    private readonly primary: DecisionProvider,
    private readonly fallback: DecisionProvider,
  ) {
    this.name = `${primary.name} → ${fallback.name}`;
  }

  async decide<Q extends Record<string, DecisionQuestion>>(state: string | Record<string, unknown>, questions: Q) {
    try {
      return await this.primary.decide(state, questions);
    } catch (error) {
      this.logger.warn(`${this.primary.name} falló (${(error as Error).message}); uso ${this.fallback.name}`);
      return this.fallback.decide(state, questions);
    }
  }
}
