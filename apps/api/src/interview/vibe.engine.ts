/**
 * "Tu vibra": de dónde sale cada dimensión del perfil y cómo se reordena la lista cuando la
 * persona arrastra una barra. Todo es determinista y sin IA: reordena dentro de la bolsa.
 */
import type { DomainConfig } from '../domains/domain.types.js';
import { hybridRank, matchPercent, percentiles, type Rankable } from './interview.engine.js';
import type { MoodProfile } from './interview.types.js';
import type { TasteProfile } from '../taste/taste.engine.js';

/** Origen de una dimensión: su texto, su respuesta, sus gustos, el contexto o una suposición. */
export type VibeSource = 'text' | 'answer' | 'taste' | 'context' | 'guess';

export interface VibeSourceInput {
  /** Dimensiones que salieron del texto inicial. */
  textKeys: string[];
  /** Dimensiones con información (texto o respuestas): `profile.informed`. */
  informed: string[];
  hasTaste: boolean;
  hasContext: boolean;
}

/** Lo informado es seguro (texto o respuesta); lo demás se supone desde gustos o contexto. */
export function vibeSources(config: DomainConfig, { textKeys, informed, hasTaste, hasContext }: VibeSourceInput): Record<string, VibeSource> {
  return Object.fromEntries(
    config.attributes
      .filter((a) => a.kind === 'scale')
      .map((a) => {
        const source: VibeSource = textKeys.includes(a.key) ? 'text' : informed.includes(a.key) ? 'answer' : hasTaste ? 'taste' : hasContext ? 'context' : 'guess';
        return [a.key, source];
      }),
  );
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Pone encima del perfil las barras que la persona ha movido (y las da por informadas). */
export function applyVibe(profile: MoodProfile, scales: Record<string, number> | undefined, config: DomainConfig): MoodProfile {
  if (!scales) return profile;
  const valid = new Set(config.attributes.filter((a) => a.kind === 'scale').map((a) => a.key));
  const next = { ...profile.scales };
  const informed = new Set(profile.informed);
  const confidence = { ...(profile.confidence ?? {}) };
  for (const [key, value] of Object.entries(scales)) {
    if (!valid.has(key) || !Number.isFinite(value)) continue;
    next[key] = Math.round(clamp01(value) * 100) / 100;
    informed.add(key);
    confidence[key] = 1;
  }
  return { ...profile, scales: next, informed: [...informed], confidence };
}

export interface VibePoolEntry<T> {
  item: T;
  /** Peso 0–1 que dejó la entrevista (o 0 sin bolsa). */
  boost: number;
}

/** Cuánto pesa lo que dejó la entrevista frente a lo que la persona acaba de mover. */
export const VIBE_BAG_BOOST = 0.3;
/** Empujón de las barras movidas: lo que acabas de arrastrar tiene que notarse en la lista. */
export const VIBE_MOVED_BOOST = 1.1;

/**
 * Reordena la bolsa con el perfil ajustado: parecido por atributos (las barras movidas pesan
 * como informadas) + gustos + el peso que dejó la entrevista. Sin IA ni embeddings.
 */
export function reorderByVibe<T extends Rankable>(
  pool: VibePoolEntry<T>[],
  profile: MoodProfile,
  config: DomainConfig,
  { taste = null, perArtist = 2, extraBoost, moved = [] }: { taste?: TasteProfile | null; perArtist?: number; extraBoost?: (item: T) => number; moved?: string[] } = {},
): { item: T; match: number }[] {
  const boosts = new Map(pool.map((p) => [p.item.id, p.boost]));
  // Cercanía a lo que has arrastrado, repartida en percentiles dentro de la bolsa.
  const closeness = pool.map(({ item }) => {
    const gaps = moved.flatMap((k) => (item.attributes[k] === undefined || profile.scales[k] === undefined ? [] : [1 - Math.abs(profile.scales[k] - item.attributes[k])]));
    return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  });
  const closePct = moved.length ? new Map(pool.map((p, i) => [p.item.id, percentiles(closeness)[i]])) : new Map<string, number>();
  const ranked = hybridRank(
    pool.map(({ item }) => ({ item, semantic: null })),
    profile,
    config,
    config.result.candidates,
    { taste, perArtist, boost: (item) => VIBE_BAG_BOOST * (boosts.get(item.id) ?? 0) + VIBE_MOVED_BOOST * (closePct.get(item.id) ?? 0) + (extraBoost?.(item) ?? 0) },
  );
  const relevance = percentiles(ranked.map((r) => r.relevance));
  return ranked.slice(0, config.result.size).map((r, i) => ({ item: r.item, match: matchPercent(relevance[i], null) }));
}
