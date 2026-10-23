import type { NewItemRow } from '../db/schema.js';

/** Elemento normalizado que un adaptador entrega al catálogo, sin id ni dominio. */
export type ImportedItem = Omit<NewItemRow, 'id' | 'domainId' | 'createdAt' | 'embedding'>;

/**
 * Un adaptador de importación trae elementos de una fuente externa y los traduce
 * a los atributos genéricos de su dominio. Añadir un dominio = un adaptador más.
 */
export interface CatalogAdapter {
  readonly domainId: string;
  readonly source: string;
  fetchItems(options: { limit: number; onProgress?: (message: string) => void }): Promise<ImportedItem[]>;
}
