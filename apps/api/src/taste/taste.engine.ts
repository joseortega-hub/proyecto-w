// Perfil de gustos (largo plazo, por dominio): lógica pura, sin IA ni base de datos.
// Los gustos no son el ánimo: no filtran nada, solo suben (o bajan) la puntuación.
import type { DomainConfig } from '../domains/domain.types.js';

/** Prefijo de los gustos que apuntan a un grupo de etiquetas del dominio ("@rpg"). */
export const GROUP_PREFIX = '@';

export type Feedback = 'up' | 'down';

/** Valoración de algo ya visto, leído, jugado o escuchado. */
export type SeenRating = 'loved' | 'liked' | 'meh';
export const SEEN_RATINGS: readonly SeenRating[] = ['loved', 'liked', 'meh'];

/**
 * Peso de cada valoración en lo aprendido, en «👍»: un 👍 vale 1 y un 👎, −1.
 * «Me encantó» cuenta más que un 👍; «bien», como un 👍; «meh», como un 👎 suave.
 */
export const RATING_WEIGHT: Record<SeenRating | Feedback, number> = { up: 1, down: -1, loved: 1.5, liked: 1, meh: -0.5 };

export interface TasteProfile {
  /** Etiquetas del catálogo o grupos (`@rpg`) que le gustan. */
  likes: string[];
  /** Lo que no le gusta, con el mismo formato. */
  dislikes: string[];
  /** Peso aprendido por etiqueta (−1 a 1) a partir de los 👍/👎. */
  learned: Record<string, number>;
}

export const emptyTaste = (): TasteProfile => ({ likes: [], dislikes: [], learned: {} });

export const hasTaste = (taste: TasteProfile | null | undefined): taste is TasteProfile =>
  !!taste && (taste.likes.length > 0 || taste.dislikes.length > 0 || Object.keys(taste.learned).length > 0);

/** Lo que suma cada 👍/👎 a las etiquetas del elemento. */
const FEEDBACK_STEP = 0.15;
/** Etiquetas de un elemento que aprenden de un 👍/👎 (las primeras son las más representativas). */
const FEEDBACK_TAGS = 8;
/** Tope de lo aprendido en la afinidad: los gustos explícitos pesan más que los 👍/👎. */
const LEARNED_CAP = 0.6;

/** Si un gusto (etiqueta o `@grupo`) coincide con las etiquetas del elemento. */
export function tasteMatches(entry: string, tags: string[], config: DomainConfig): boolean {
  if (!entry.startsWith(GROUP_PREFIX)) return tags.includes(entry);
  const group = config.tagGroups.find((g) => g.key === entry.slice(GROUP_PREFIX.length));
  return !!group && tags.some((t) => group.tags.includes(t));
}

/**
 * Afinidad del elemento con los gustos, de −1 a 1. Un gusto que coincide da 0,6 y cada
 * uno más 0,2; lo que no le gusta resta algo más fuerte; lo aprendido suma hasta ±0,6.
 */
export function tasteAffinity(item: { tags: string[] }, taste: TasteProfile | null | undefined, config: DomainConfig): number {
  if (!hasTaste(taste)) return 0;
  const liked = taste.likes.filter((l) => tasteMatches(l, item.tags, config)).length;
  const disliked = taste.dislikes.filter((d) => tasteMatches(d, item.tags, config)).length;
  const pos = liked ? Math.min(1, 0.6 + 0.2 * (liked - 1)) : 0;
  const neg = disliked ? Math.min(1, 0.8 + 0.2 * (disliked - 1)) : 0;
  const learned = item.tags.reduce((sum, t) => sum + (taste.learned[t] ?? 0), 0);
  const total = pos - neg + Math.max(-LEARNED_CAP, Math.min(LEARNED_CAP, learned));
  return Math.round(Math.max(-1, Math.min(1, total)) * 100) / 100;
}

/**
 * Ajusta lo aprendido con un 👍/👎 o con la valoración de algo ya visto (con su peso). Si ya había una valoración del mismo elemento, se
 * deshace primero, así cambiar de opinión (o quitarla, `next = null`) no acumula.
 * `common` son etiquetas demasiado frecuentes en el catálogo ("singleplayer"): no enseñan nada.
 */
export function applyFeedback(
  learned: Record<string, number>,
  tags: string[],
  previous: Feedback | SeenRating | null,
  next: Feedback | SeenRating | null,
  common: ReadonlySet<string> = new Set(),
): Record<string, number> {
  const out = { ...learned };
  const useful = tags.filter((t) => !common.has(t)).slice(0, FEEDBACK_TAGS);
  const shift = (weight: number) => {
    for (const t of useful) out[t] = Math.max(-1, Math.min(1, (out[t] ?? 0) + weight * FEEDBACK_STEP));
  };
  if (previous) shift(-RATING_WEIGHT[previous]);
  if (next) shift(RATING_WEIGHT[next]);
  for (const [t, w] of Object.entries(out)) {
    if (Math.abs(w) < 0.01) delete out[t];
    else out[t] = Math.round(w * 100) / 100;
  }
  return out;
}

/** Nombre legible de una etiqueta o grupo ("open-world" → "open world", "@rpg" → "rol y aventura"). */
export function tasteLabel(entry: string, config: DomainConfig): string {
  if (entry.startsWith(GROUP_PREFIX)) {
    return config.tagGroups.find((g) => g.key === entry.slice(GROUP_PREFIX.length))?.label ?? entry.slice(1);
  }
  return entry.replace(/[-_]+/g, ' ').trim();
}

/** Los gustos sin lo que la persona desactivó para esta entrevista (ids: la etiqueta o `@grupo`). */
export function withoutOff(taste: TasteProfile | null | undefined, off: readonly string[] = []): TasteProfile | null {
  if (!taste) return null;
  if (!off.length) return taste;
  const out = { ...taste, likes: taste.likes.filter((l) => !off.includes(l)), dislikes: taste.dislikes.filter((d) => !off.includes(d)) };
  return hasTaste(out) ? out : null;
}

/** Grupos de estilo que los gustos (a favor o en contra) ya cubren, por grupo (`@urban`) o por una de sus etiquetas. */
export function coveredGroups(taste: TasteProfile | null | undefined, config: DomainConfig): Set<string> {
  if (!taste) return new Set();
  const entries = [...taste.likes, ...taste.dislikes];
  return new Set(
    config.tagGroups
      .filter((g) => entries.some((e) => e === GROUP_PREFIX + g.key || g.tags.includes(e)))
      .map((g) => g.key),
  );
}

/** Los gustos en palabras, para el `state` de las decisiones (siempre como dato). */
export function tasteState(taste: TasteProfile | null | undefined, config: DomainConfig) {
  if (!hasTaste(taste)) return null;
  const learned = Object.entries(taste.learned).sort((a, b) => b[1] - a[1]);
  return {
    leGusta: taste.likes.map((l) => tasteLabel(l, config)),
    noLeGusta: taste.dislikes.map((d) => tasteLabel(d, config)),
    leHanGustado: learned.filter(([, w]) => w >= 0.25).slice(0, 6).map(([t]) => tasteLabel(t, config)),
    noLeHanGustado: learned.filter(([, w]) => w <= -0.25).slice(0, 6).map(([t]) => tasteLabel(t, config)),
  };
}

/** Gustos explícitos que cumple el elemento, para las explicaciones ("rol y aventura"). */
export function tasteHints(item: { tags: string[] }, taste: TasteProfile | null | undefined, config: DomainConfig): string[] {
  if (!hasTaste(taste)) return [];
  return taste.likes.filter((l) => tasteMatches(l, item.tags, config)).map((l) => tasteLabel(l, config));
}

/**
 * Si la persona ya contó sus gustos, la entrevista no pregunta por estilos: solo por el
 * ánimo. Devuelve las sondas que informan únicamente de grupos de etiquetas.
 */
export function tasteOnlyProbes(config: DomainConfig): Set<string> {
  const tagDims = new Set(config.attributes.filter((a) => a.kind === 'tags').map((a) => a.key));
  return new Set(config.probes.filter((p) => p.informs.every((d) => tagDims.has(d))).map((p) => p.id));
}
