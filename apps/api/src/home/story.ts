/**
 * "Tu historia": agregados puros de las listas, los gustos y las trazas de una persona.
 * Sin base de datos ni IA: el servicio les pasa las filas y esto saca las cuentas.
 */
import type { DomainConfig } from '../domains/domain.types.js';
import { tasteHints, tasteLabel, type TasteProfile } from '../taste/taste.engine.js';

export interface Counted {
  label: string;
  count: number;
}

export interface StoryItem {
  id: string;
  subtitle: string | null;
  tags: string[];
}

const top = (counts: Map<string, number>, limit: number, min = 1): Counted[] =>
  [...counts]
    .filter(([, count]) => count >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));

const bump = (counts: Map<string, number>, key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);

/**
 * Lo más frecuente en las listas de una temática: quién firma (artistas, sagas, autores),
 * los estilos (grupos de etiquetas del dominio) y qué parte de lo recomendado va con sus gustos.
 */
export function listsTop(entries: StoryItem[], config: DomainConfig, taste: TasteProfile | null) {
  const creators = new Map<string, number>();
  const genres = new Map<string, number>();
  let liked = 0;
  for (const item of entries) {
    if (item.subtitle) bump(creators, item.subtitle);
    for (const g of config.tagGroups) if (item.tags.some((t) => g.tags.includes(t))) bump(genres, g.label);
    if (tasteHints(item, taste, config).length > 0) liked += 1;
  }
  return {
    creators: top(creators, 5, 2),
    genres: top(genres, 5),
    total: entries.length,
    liked,
  };
}

/** Lo aprendido de los 👍/👎 y lo que contó la persona, con las etiquetas legibles. */
export function learnedView(taste: TasteProfile | null, feedback: Record<string, 'up' | 'down'>, config: DomainConfig) {
  const learned = Object.entries(taste?.learned ?? {});
  const label = (t: string) => tasteLabel(t, config);
  return {
    likes: (taste?.likes ?? []).map(label),
    dislikes: (taste?.dislikes ?? []).map(label),
    up: learned
      .filter(([, w]) => w >= 0.1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, w]) => ({ label: label(tag), weight: w })),
    down: learned
      .filter(([, w]) => w <= -0.1)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 6)
      .map(([tag, w]) => ({ label: label(tag), weight: w })),
    thumbsUp: Object.values(feedback).filter((f) => f === 'up').length,
    thumbsDown: Object.values(feedback).filter((f) => f === 'down').length,
  };
}

export interface TraceLite {
  provider: string | null;
  ok: boolean;
  free: boolean;
  listCostEur: number;
}

/** La IA en números: llamadas por proveedor y coste (de lista y realmente pagado). */
export function aiNumbers(traces: TraceLite[]) {
  const providers = new Map<string, number>();
  let listCost = 0;
  let paid = 0;
  for (const t of traces) {
    if (t.ok && t.provider) bump(providers, t.provider);
    listCost += t.listCostEur;
    if (!t.free) paid += t.listCostEur;
  }
  return {
    calls: traces.length,
    providers: top(providers, 6),
    listCostEur: Math.round(listCost * 10000) / 10000,
    paidEur: Math.round(paid * 10000) / 10000,
  };
}
