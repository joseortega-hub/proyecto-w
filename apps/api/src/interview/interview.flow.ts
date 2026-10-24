// Qué se puede preguntar a continuación. Lógica pura, sin IA ni base de datos.
import type { DomainConfig, Probe } from '../domains/domain.types.js';
import { tasteOnlyProbes } from '../taste/taste.engine.js';
import { answered, informedDimensions, minQuestions, remainingProbes } from './interview.engine.js';
import type { Answer, InterviewTurn } from './interview.types.js';

/** Lo que ya se sabe antes de preguntar. */
export interface InterviewFacts {
  /** Dimensiones que ya dejó claras el texto inicial. */
  known?: string[];
  /** Sondas que sobran porque la persona ya contó sus gustos (las de solo estilo). */
  skip?: Set<string>;
  /** Hay gustos guardados o algo pedido: en los dominios con `stylesLast` no se pregunta por estilos. */
  noStyles?: boolean;
}

/** Respuestas antes de las cuales no se pregunta por estilos en los dominios con `stylesLast`. */
export const STYLES_AFTER = 3;

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
  let pool = moodOnly.length ? moodOnly : useful;
  const done = answered(turns).length;
  // Música: se pregunta por el momento o el uso, y los géneros solo al final y si no hay gustos ni algo pedido.
  if (config.interview.stylesLast) {
    const styles = tasteOnlyProbes(config);
    const noStyles = pool.filter((p) => !styles.has(p.id));
    // Con gustos o algo pedido, nunca (si no queda otra cosa, mejor terminar); sin ellos, al final.
    if (facts.noStyles || (noStyles.length && done < STYLES_AFTER)) pool = noStyles;
  }
  if (config.interview.momentFirst && done < config.interview.momentFirst) {
    const moments = pool.filter((p) => p.moment);
    if (moments.length) pool = moments;
  }
  return pool;
}

/** Garantía final: nunca se añade una pregunta cuya sonda ya se hizo en esta entrevista. */
export function assertNotAsked(turns: InterviewTurn[], probeId: string) {
  if (turns.some((t) => t.probeId === probeId)) {
    throw new Error(`La pregunta "${probeId}" ya se hizo en esta entrevista`);
  }
}

/**
 * Respuestas automáticas a partir del texto inicial (clientes sin pantalla, como el MCP):
 * si el texto ya no da para más (dos "no lo sé" seguidos con el mínimo de preguntas
 * cubierto), seguir preguntando solo gasta cupo y se termina con lo que hay.
 */
export function autoAnswerExhausted(turns: InterviewTurn[], answer: Answer, config: DomainConfig, known: string[] = []): boolean {
  const done = turns.filter((t) => t.answer !== null);
  return answer === 'unknown' && done.at(-1)?.answer === 'unknown' && done.length + 1 >= minQuestions(config, known);
}

/**
 * Con algo concreto pedido ("Pokémon"), la entrevista termina antes en vez de rellenar:
 * - `exhausted`: ya se preguntó por lo que distingue a sus elementos (y van al menos 3);
 * - `unwritten`: no se ha podido redactar la pregunta con el ancla (y van al menos 2).
 * Sin anclas, nunca: manda el flujo normal.
 */
export function anchorsDone(
  anchors: number,
  hasFocus: boolean,
  focusedLeft: number,
  answeredCount: number,
  reason: 'exhausted' | 'unwritten',
): boolean {
  if (!anchors) return false;
  if (reason === 'unwritten') return answeredCount >= 2;
  return hasFocus && focusedLeft === 0 && answeredCount >= 3;
}
