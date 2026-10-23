/**
 * Decisiones tipadas, no texto. La interfaz copia las tres primitivas de Jev
 * (choice, score, noul) para que cualquier proveedor pueda ocupar su lugar.
 */
export type DecisionQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'score'; instructions: string; criteria: [string, string, ...string[]] }
  | { type: 'noul'; instructions: string };

export type DecisionAnswer =
  | { type: 'choice'; choice: string; confidence: number | null }
  /** `score` normalizado a 0–1 (nivel esperado / último nivel). */
  | { type: 'score'; score: number }
  /** Probabilidad de "sí", 0–1. */
  | { type: 'noul'; probability: number };

export type AnswerFor<Q extends DecisionQuestion> = Extract<DecisionAnswer, { type: Q['type'] }>;

export interface DecisionProvider {
  readonly name: string;
  /** Responde todas las preguntas contra un mismo estado en una sola llamada. */
  decide<Q extends Record<string, DecisionQuestion>>(
    state: string | Record<string, unknown>,
    questions: Q,
  ): Promise<{ [K in keyof Q]: AnswerFor<Q[K]> }>;
}

export const DECISION_PROVIDER = Symbol('DecisionProvider');
/**
 * Decisiones rápidas de la entrevista (elegir la siguiente pregunta). Va aparte porque
 * admite proveedores más rápidos pero menos precisos con `score`/`noul` (Laya, Groq).
 */
export const INTERVIEW_DECISION_PROVIDER = Symbol('InterviewDecisionProvider');
