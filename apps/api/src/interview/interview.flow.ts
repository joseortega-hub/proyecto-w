// Qué se puede preguntar a continuación. Lógica pura, sin IA ni base de datos.
import type { DomainConfig, Probe } from '../domains/domain.types.js';
import { informedDimensions, remainingProbes } from './interview.engine.js';
import type { InterviewTurn } from './interview.types.js';

/**
 * Preguntas que aún aportan algo. Fuera quedan:
 * - las ya hechas (aunque se respondieran con "No lo sé"), y
 * - las redundantes: todo lo que informan ya está resuelto. Por ejemplo, "¿es para una
 *   fiesta?" (energía + ritmo) sobra si ya se respondió sobre energía y sobre baile.
 * Las dimensiones de etiquetas (estilos) no cuentan como resueltas: cada pregunta de
 * estilo pregunta por un grupo distinto.
 */
export function askableProbes(turns: InterviewTurn[], config: DomainConfig): Probe[] {
  const informed = informedDimensions(turns, config);
  const tagDims = new Set(config.attributes.filter((a) => a.kind === 'tags').map((a) => a.key));
  return remainingProbes(turns, config).filter((p) =>
    p.informs.some((dim) => tagDims.has(dim) || !informed.has(dim)),
  );
}

/** Garantía final: nunca se añade una pregunta cuya sonda ya se hizo en esta entrevista. */
export function assertNotAsked(turns: InterviewTurn[], probeId: string) {
  if (turns.some((t) => t.probeId === probeId)) {
    throw new Error(`La pregunta "${probeId}" ya se hizo en esta entrevista`);
  }
}
