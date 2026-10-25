/** Tamaño de la lista que elige la persona: entre `min` y `max` elementos. */
export interface SizeRange {
  min: number;
  max: number;
}

/** Límites duros: 50 es lo que cabe sin disparar llamadas ni cuota (YouTube cuesta ~50 por canción al guardar). */
export const SIZE_LIMITS: SizeRange = { min: 5, max: 50 };
export const DEFAULT_SIZE: SizeRange = { min: 10, max: 20 };
/** A partir de este % de encaje, un elemento cuenta como "encaja de verdad". */
export const GOOD_MATCH = 70;

/** Deja el rango dentro de los límites y con min ≤ max; si no llega nada válido, el de por defecto. */
export function normalizeRange(min?: unknown, max?: unknown): SizeRange {
  const clamp = (n: number) => Math.min(SIZE_LIMITS.max, Math.max(SIZE_LIMITS.min, Math.round(n)));
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(lo) && !Number.isFinite(hi)) return DEFAULT_SIZE;
  const a = Number.isFinite(lo) ? clamp(lo) : DEFAULT_SIZE.min;
  const b = Number.isFinite(hi) ? clamp(hi) : Math.max(a, DEFAULT_SIZE.max);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/**
 * Elige la lista dentro de la bolsa ya ordenada: todos los que encajan bien hasta `max`; si no llegan a `min`,
 * completa con los mejores del resto. `keep` marca los que entran siempre (los títulos pedidos).
 */
export function pickBySize<T extends { match: number }>(sorted: T[], range: SizeRange, keep: (t: T) => boolean = () => false) {
  const good = sorted.filter((t) => keep(t) || t.match >= GOOD_MATCH);
  const chosen = new Set(good.slice(0, range.max));
  const goodCount = chosen.size;
  for (const t of sorted) {
    if (chosen.size >= range.min) break;
    chosen.add(t);
  }
  return { picked: sorted.filter((t) => chosen.has(t)), good: goodCount, filled: chosen.size - goodCount };
}

/** Aviso cuando hubo que completar hasta el mínimo con elementos que encajan menos. */
export function sizeNotice(good: number, filled: number, nounPlural: string): string | null {
  return filled > 0 ? `Solo ${good} ${nounPlural} encajan de verdad; te completo con ${filled} más que se les parecen.` : null;
}
