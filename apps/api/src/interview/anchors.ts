// Intención explícita: lo concreto que pide la persona ("algo de Marvel", "Pokémon").
// Lógica pura, sin IA ni base de datos, común a todos los dominios.
import { z } from 'zod';
import type { DomainConfig } from '../domains/domain.types.js';
import { characterWords, matchHints, normalize, type Rankable } from './interview.engine.js';

export { normalize, probeDirection } from './interview.engine.js';
import type { Anchor, MoodProfile } from './interview.types.js';
import { meetsAny } from './catalog-match.js';

/** A partir de esta puntuación, un elemento cuenta como "del ancla". */
export const ANCHOR_MATCH = 0.5;
/** Cuánto sube la relevancia (0–1) de lo que coincide con el ancla cuando no se filtra. */
export const ANCHOR_BOOST = 0.6;

export interface AnchorItem extends Rankable {
  title: string;
  description: string | null;
  facets?: Record<string, string | string[]>;
}

/** Si el ancla está resuelta contra el catálogo (condiciones exactas) y no solo como texto. */
export const isStructured = (anchor: Anchor) => !!(anchor.match?.length || anchor.ids?.length);

/** Títulos pedidos (semillas): van primero y el resto de la lista se parece a ellos. */
export const seedIds = (anchors: Anchor[]) => anchors.filter((a) => a.kind === 'title').flatMap((a) => a.ids ?? []);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Términos útiles de un ancla (normalizados, sin duplicados ni términos de menos de 3 letras). */
export function anchorTerms(anchor: Anchor): string[] {
  return [...new Set([anchor.label, ...anchor.terms].map(normalize).filter((t) => t.length >= 3))];
}

/** Si el texto contiene el término como palabra completa ("thor" no casa con "author"). */
const contains = (text: string, term: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(term)}($|[^\\p{L}\\p{N}])`, 'u').test(text);

/** Si un texto suelto (nombre de un resultado en directo) menciona el ancla. */
export const anchorMatchesText = (text: string, anchor: Anchor) => {
  const normalized = normalize(text);
  return anchorTerms(anchor).some((t) => contains(normalized, t));
};

/**
 * Cuánto coincide un elemento con un ancla, 0–1: en el título o el creador cuenta del
 * todo, en las etiquetas casi, y en la descripción a medias (puede ser una mención suelta).
 */
export function anchorScore(item: AnchorItem, anchor: Anchor): number {
  // Resuelta contra el catálogo: o la cumple de verdad, o no (nada de menciones sueltas).
  if (isStructured(anchor)) return anchor.ids?.includes(item.id) || meetsAny({ ...item, subtitle: item.subtitle ?? null }, anchor.match ?? []) ? 1 : 0;
  const terms = anchorTerms(anchor);
  if (!terms.length) return 0;
  const title = normalize(`${item.title} ${item.subtitle ?? ''}`);
  if (terms.some((t) => contains(title, t))) return 1;
  const tags = item.tags.map(normalize);
  if (terms.some((t) => tags.some((tag) => tag === t || contains(tag, t)))) return 0.8;
  const description = normalize(item.description ?? '');
  if (description && terms.some((t) => contains(description, t))) return 0.5;
  return 0;
}

/** La mejor coincidencia con cualquiera de las anclas, y con cuál. */
export function bestAnchor(item: AnchorItem, anchors: Anchor[]): { anchor: Anchor | null; score: number } {
  let best: { anchor: Anchor | null; score: number } = { anchor: null, score: 0 };
  for (const anchor of anchors) {
    const score = anchorScore(item, anchor);
    if (score > best.score) best = { anchor, score };
  }
  return best;
}

export const anchorMatches = <T extends AnchorItem>(items: T[], anchors: Anchor[]) =>
  anchors.length ? items.filter((it) => bestAnchor(it, anchors).score >= ANCHOR_MATCH) : [];

/**
 * Qué hacer con las anclas en la búsqueda:
 * - `filter`: lo pidió de forma explícita y hay de sobra → la bolsa es solo eso.
 * - `boost`: hay pocas (o era una referencia vaga) → se suben mucho, sin quitar el resto.
 * - `none`: sin anclas.
 */
export function anchorMode(anchors: Anchor[], matched: number, size: number): 'filter' | 'boost' | 'none' {
  if (!anchors.length) return 'none';
  // Lo pedido de forma explícita y resuelto contra el catálogo (Marvel, Nintendo, un autor) es
  // un filtro duro aunque haya pocos: la lista es SOLO eso. Un género, solo si da para una lista.
  // Los títulos (semillas) nunca filtran: se ponen primero y el resto se parece a ellos.
  const hard = anchors.filter((a) => a.required && a.kind !== 'title');
  if (hard.some((a) => isStructured(a) && a.kind !== 'tag') && matched >= 1) return 'filter';
  return hard.length && matched >= size ? 'filter' : 'boost';
}

const joinLabels = (anchors: Anchor[]) => anchors.map((a) => a.label).join(' o ');

/** Aviso cuando el catálogo se queda corto para lo que pidió. Nunca en silencio. */
export function anchorNotice(anchors: Anchor[], inList: number, size: number, itemNounPlural: string, gender: 'f' | 'm', mode: 'filter' | 'boost' = 'boost'): string | null {
  // Los títulos pedidos (semillas) no cuentan: el resto de la lista son parecidos a propósito.
  anchors = anchors.filter((a) => a.kind !== 'title');
  if (!anchors.length || inList >= size) return null;
  const labels = joinLabels(anchors);
  if (mode === 'filter') return `Solo hay ${inList} de ${labels}: te pongo solo ${gender === 'f' ? 'esas' : 'esos'}.`;
  const similar = gender === 'f' ? 'parecidas' : 'parecidos';
  if (inList === 0) return `No tengo ${itemNounPlural} de ${labels}, así que te pongo ${gender === 'f' ? 'las' : 'los'} más ${similar}.`;
  return `Solo tengo ${inList} de ${labels}; te completo la lista con ${itemNounPlural} ${similar}.`;
}

/** Dimensiones de escala que más separan a los elementos del ancla (mayor varianza primero). */
export function anchorDimensions(items: Rankable[], config: DomainConfig): string[] {
  if (items.length < 3) return [];
  return config.attributes
    .filter((a) => a.kind === 'scale')
    .map((a) => {
      const values = items.map((it) => it.attributes[a.key]).filter((v) => v !== undefined);
      const mean = values.reduce((s, v) => s + v, 0) / (values.length || 1);
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length || 1);
      return { key: a.key, variance, n: values.length };
    })
    .filter((d) => d.n >= 3 && d.variance >= 0.01)
    .sort((a, b) => b.variance - a.variance)
    .map((d) => d.key);
}

/** Ejemplo del ancla para una pregunta: el elemento más extremo en la dirección del "sí". */
export function anchorExample<T extends AnchorItem>(items: T[], dimension: string, direction: 'high' | 'low'): T | null {
  const withValue = items.filter((it) => it.attributes[dimension] !== undefined);
  if (!withValue.length) return null;
  return withValue.reduce((best, it) =>
    direction === 'high' ? (it.attributes[dimension] > best.attributes[dimension] ? it : best) : it.attributes[dimension] < best.attributes[dimension] ? it : best,
  );
}

export interface ReasonContext {
  config: DomainConfig;
  profile: MoodProfile;
  anchors: Anchor[];
  /** Gustos de la persona con los que coincide ("rol y aventura"). */
  likes: string[];
}

/**
 * "Por qué" de una línea con datos concretos, por plantillas y sin IA:
 * "Es de Marvel, como pediste · dir. James Gunn (2014) · divertida y trepidante · va con tus gustos: superhéroes".
 */
export function shortReason(item: AnchorItem & { facets?: Record<string, string | string[]> }, ctx: ReasonContext): string {
  const { config, profile, anchors, likes } = ctx;
  const parts: string[] = [];
  const best = bestAnchor(item, anchors);
  const anchor = best.score >= ANCHOR_MATCH ? best.anchor : null;
  if (anchor) parts.push(`Es de ${anchor.label}, como pediste`);

  // Quién lo firma y de qué año: datos de la fuente, nunca inventados.
  const creatorIsAnchor = anchor?.kind === 'creator';
  const year = typeof item.facets?.year === 'string' ? item.facets.year : null;
  if (item.subtitle && !creatorIsAnchor) parts.push(`${config.creatorPrefix ?? 'de'} ${item.subtitle}${year ? ` (${year})` : ''}`);
  else if (year) parts.push(`de ${year}`);

  const hints = matchHints(item, profile, config).slice(0, 2);
  const character = hints.length ? hints : characterWords(item.attributes, config).slice(0, 2);
  if (character.length) parts.push(character.join(' y '));
  if (likes.length) parts.push(`va con tus gustos: ${likes.slice(0, 2).join(', ')}`);

  const line = parts.join(' · ');
  return line ? line.charAt(0).toUpperCase() + line.slice(1) : `Encaja con lo que buscas`;
}

/** Texto para la consulta semántica: lo pedido pesa aunque el texto inicial ya se haya borrado. */
export const anchorQueryText = (anchors: Anchor[]) =>
  anchors.length ? `Pedido concreto: ${anchors.map((a) => [a.label, ...a.terms.slice(0, 5)].join(', ')).join('; ')}` : null;

// --- Extracción: forma que devuelve la IA ---

export const anchorItemSchema = z.object({
  label: z.string().describe('El nombre tal y como se escribe normalmente ("Marvel", "Pokémon", "Brandon Sanderson", "dembow")'),
  kind: z
    .enum(['franchise', 'creator', 'studio', 'title', 'tag'])
    .describe('franchise: franquicia o saga; creator: persona (artista, autor, director); studio: estudio, compañía o sello; title: una obra concreta; tag: género o estilo concreto'),
  terms: z
    .array(z.string())
    .describe('De 4 a 10 términos para encontrarlo en títulos, etiquetas o sinopsis: el nombre, sus variantes en español e inglés y, en franquicias, sagas y estudios, sus títulos y personajes más conocidos tal como aparecen en los títulos (p. ej. para Marvel: "Vengadores", "Avengers", "Spider-Man", "Iron Man", "Thor", "Capitán América", "Black Panther", "Guardianes de la Galaxia")'),
  required: z.boolean().describe('true si lo pide de forma explícita ("algo de Marvel"); false si es una referencia de estilo ("algo tipo Marvel")'),
});


/** Como mucho 3 anclas, con el nombre y los términos limpios. */
export const cleanAnchors = (anchors: Anchor[]): Anchor[] =>
  anchors
    .filter((a) => a.label.trim())
    .slice(0, 3)
    .map((a) => ({ ...a, label: a.label.trim(), terms: [...new Set(a.terms.map((t) => t.trim()).filter(Boolean))].slice(0, 10) }));

