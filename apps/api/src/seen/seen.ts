// «Ya lo vi / leí / jugué / escuché»: lógica pura, sin base de datos.
import type { SeenRating } from '../taste/taste.engine.js';

/** Temáticas públicas con «ya visto» (los catálogos personales ya son de la persona). */
export const SEEN_DOMAINS = ['movies', 'books', 'games', 'music'] as const;
export type SeenDomain = (typeof SEEN_DOMAINS)[number];

export const isSeenDomain = (domainId: string): domainId is SeenDomain => (SEEN_DOMAINS as readonly string[]).includes(domainId);

/** De dónde viene una marca. */
export type SeenSource = 'app' | 'letterboxd' | 'goodreads' | 'steam';

export interface SeenMark {
  itemId: string;
  rating: SeenRating | null;
}

/**
 * Fusiona marcas nuevas con las que ya había: una valoración nueva gana y, sin ella, se
 * conserva la anterior (importar sin notas no borra lo que valoró en la app).
 */
export function mergeMarks(existing: ReadonlyMap<string, SeenRating | null>, incoming: SeenMark[]) {
  const latest = new Map<string, SeenRating | null>();
  for (const m of incoming) latest.set(m.itemId, m.rating ?? latest.get(m.itemId) ?? null);
  return [...latest].map(([itemId, rating]) => {
    const previous = existing.get(itemId) ?? null;
    return { itemId, previous, next: rating ?? previous, isNew: !existing.has(itemId) };
  });
}
