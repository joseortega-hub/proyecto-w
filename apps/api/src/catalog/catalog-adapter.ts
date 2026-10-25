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
}

/** Etiqueta con la que se marcan los resultados de una búsqueda en directo ("marvel"). */
export const anchorTag = (anchor: Anchor) => anchor.label.toLowerCase().trim();
