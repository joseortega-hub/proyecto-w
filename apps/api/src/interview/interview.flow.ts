// Qué se puede preguntar a continuación. Lógica pura, sin IA ni base de datos.
import type { DomainConfig, Probe } from '../domains/domain.types.js';
import { informedDimensions, remainingProbes } from './interview.engine.js';
import type { InterviewTurn } from './interview.types.js';

/** Lo que ya se sabe antes de preguntar. */
export interface InterviewFacts {
  /** Dimensiones que ya dejó claras el texto inicial. */
  known?: string[];
  /** Sondas que sobran porque la persona ya contó sus gustos (las de solo estilo). */
  skip?: Set<string>;
}

/**
 * Preguntas que aún aportan algo. Fuera quedan:
 * - las ya hechas (aunque se respondieran con "No lo sé"), y
 * - las redundantes: todo lo que informan ya está resuelto. Por ejemplo, "¿es para una
 *   fiesta?" (energía + ritmo) sobra si ya se respondió sobre energía y sobre baile.
 * Las dimensiones de etiquetas (estilos) no cuentan como resueltas: cada pregunta de
 * estilo pregunta por un grupo distinto. Las dimensiones que ya aclaró el texto inicial
 * cuentan como resueltas.
 */
export function askableProbes(turns: InterviewTurn[], config: DomainConfig, facts: InterviewFacts = {}): Probe[] {
  const informed = informedDimensions(turns, config, facts.known);
  const tagDims = new Set(config.attributes.filter((a) => a.kind === 'tags').map((a) => a.key));
  const useful = remainingProbes(turns, config).filter((p) =>
    p.informs.some((dim) => tagDims.has(dim) || !informed.has(dim)),
  );
  // Con gustos guardados se salta lo que es solo de estilo, salvo que no quede otra cosa.
  const skip = facts.skip;
  const moodOnly = skip?.size ? useful.filter((p) => !skip.has(p.id)) : useful;
  return moodOnly.length ? moodOnly : useful;
}

/** Garantía final: nunca se añade una pregunta cuya sonda ya se hizo en esta entrevista. */
export function assertNotAsked(turns: InterviewTurn[], probeId: string) {
  if (turns.some((t) => t.probeId === probeId)) {
    throw new Error(`La pregunta "${probeId}" ya se hizo en esta entrevista`);
  }
}
