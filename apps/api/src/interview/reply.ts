// Respuesta libre en mitad de la entrevista: lo que se entendió, en una línea y sin el texto.
// Lógica pura, sin IA ni base de datos.
import type { DomainConfig } from '../domains/domain.types.js';
import type { Answer, Understanding } from './interview.types.js';

/** "Eso no tiene sentido", "no me entiendes", "olvida eso": descartar lo último entendido. */
export const NONSENSE = /\b(no tiene (ningun )?sentido|sin sentido|no me (has )?entend\w*|no es eso|olvida (eso|lo ultimo)|te has liado|nada que ver)\b/;

/** Sí o no a la pregunta por cómo empieza la respuesta ("sí, pero…", "no, más romántico"). */
export function answerFromText(text: string): Answer | undefined {
  const t = text.trim().toLowerCase();
  if (/^(s[ií]|vale|claro|venga|dale|por supuesto|me vale)(?![\p{L}])/u.test(t)) return 'yes';
  if (/^(no|nah|para nada|qu[eé] va|ni de broma)(?![\p{L}])/u.test(t)) return 'no';
  return undefined;
}

const joinParts = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : (parts[0] ?? ''));

/** "más romántica, de Marvel y nada de terror"; vacío si no se entendió nada. */
export function replySummary(u: Understanding, answer: Answer, config: DomainConfig): string {
  const parts: string[] = [];
  for (const m of u.moods) {
    const attr = config.attributes.find((a) => a.key === m.key);
    const label = m.level === 'high' ? attr?.highLabel : attr?.lowLabel;
    if (label) parts.push(`más ${label}`);
  }
  for (const a of u.anchors) parts.push(a.kind === 'title' ? `con «${a.label}»` : a.required ? `de ${a.label}` : `tipo ${a.label}`);
  for (const g of config.tagGroups.filter((x) => u.exclusions.includes(x.key))) parts.push(`nada de ${g.label}`);
  if (!parts.length && answer !== 'unknown') parts.push(answer === 'yes' ? 'eso es un sí' : 'eso es un no');
  return joinParts(parts.slice(0, 4));
}
