// Elegir variante del banco: lógica pura, sin IA ni base de datos.
import type { InterviewTurn } from './interview.types.js';

export interface BankVariant {
  variant: number;
  question: string;
  reason: string;
}

const STOPWORDS = new Set(
  'algo alguna alguno ahora como con cual cuando del desde donde el ella ellos en esa ese esta este hoy la las le les lo los mas me mi muy para pero por que quieres se sea si sin su sus te tu un una uno unos y ya apetece buscas prefieres'.split(
    ' ',
  ),
);

/** Palabras con contenido de una pregunta, en minúsculas y sin tildes. */
export function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-zñ]+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

/**
 * La variante que menos palabras comparte con las preguntas ya hechas, para que la
 * entrevista no suene repetida ("bailar" dos veces seguidas). Empates: al azar.
 */
export function pickVariant(variants: BankVariant[], turns: InterviewTurn[], random = Math.random): BankVariant | null {
  if (!variants.length) return null;
  const used = new Set(turns.flatMap((t) => [...keywords(t.text)]));
  const scored = variants.map((v) => ({ v, overlap: [...keywords(v.question)].filter((w) => used.has(w)).length }));
  const best = Math.min(...scored.map((s) => s.overlap));
  const candidates = scored.filter((s) => s.overlap === best);
  return candidates[Math.floor(random() * candidates.length)].v;
}
