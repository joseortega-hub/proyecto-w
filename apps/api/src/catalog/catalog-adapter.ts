import type { NewItemRow } from '../db/schema.js';
import type { Anchor } from '../interview/interview.types.js';

/** Elemento normalizado que un adaptador entrega al catálogo, sin id ni dominio. */
export type ImportedItem = Omit<NewItemRow, 'id' | 'domainId' | 'createdAt' | 'embedding'> & {
  /** Pistas para clasificar facetas que la fuente no trae (p. ej. un trozo de la letra). No se guardan. */
  classifyHints?: string;
};

/**
 * Un adaptador de importación trae elementos de una fuente externa y los traduce
 * a los atributos genéricos de su dominio. Añadir un dominio = un adaptador más.
 */
export interface CatalogAdapter {
  readonly domainId: string;
  readonly source: string;
  fetchItems(options: { limit: number; onProgress?: (message: string) => void }): Promise<ImportedItem[]>;
  /**
   * Búsqueda en directo de lo que pidió la persona ("Marvel", "Pokémon") cuando el catálogo
   * se queda corto. Los resultados de una búsqueda estructurada (compañía, persona, estudio)
   * llevan la etiqueta del ancla, para que el catálogo los reconozca después.
   */
  search?(anchor: Anchor, limit: number): Promise<ImportedItem[]>;
  /**
   * Cómo se escribe de verdad un nombre que la persona escribió con errata ("saran j maas" →
   * "Sarah J. Maas"), según la fuente: autor, persona, compañía o desarrolladora. Null si no hay uno parecido.
   */
  resolveName?(name: string, kinds: Anchor['kind'][]): Promise<{ name: string; kind: Anchor['kind'] } | null>;
  /**
   * Un título concreto del historial de la persona (importar de Letterboxd, Goodreads o Steam):
   * su id en la fuente y, solo si hace falta guardarlo, el elemento entero. Null si no hay uno claro.
   */
  lookup?(entry: HistoryLookup): Promise<{ externalId: string; item: () => Promise<ImportedItem | null> } | null>;
}

export interface HistoryLookup {
  title: string;
  year?: number;
  author?: string;
}

/** Etiqueta con la que se marcan los resultados de una búsqueda en directo ("marvel"). */
export const anchorTag = (anchor: Anchor) => anchor.label.toLowerCase().trim();

/**
 * Ids de las palabras clave (o etiquetas) de una fuente que corresponden a una temática: se busca
 * cada palabra clave en inglés del ancla y vale la que la contiene entera ("apocalypse" → "post-apocalyptic future").
 */
export async function themeKeywordIds(anchor: Anchor, search: (query: string) => Promise<{ id: number; name?: string }[]>, max = 8): Promise<number[]> {
  const keys = anchor.terms.slice(1, 6);
  const ids: number[] = [];
  for (const results of await Promise.all(keys.map((k) => search(k)))) {
    for (const r of results.slice(0, 10)) {
      const name = (r.name ?? '').toLowerCase();
      if (keys.some((k) => name.includes(k.toLowerCase())) && !ids.includes(r.id)) ids.push(r.id);
    }
  }
  return ids.slice(0, max);
}
