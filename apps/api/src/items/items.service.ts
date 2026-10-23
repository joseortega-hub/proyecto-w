import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, cosineDistance, eq, getTableColumns, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { items, type ItemRow } from '../db/schema.js';

/** Columnas de un elemento sin el embedding (768 números que no hacen falta fuera de pgvector). */
const { embedding: _embedding, ...itemColumns } = getTableColumns(items);
export type ItemWithoutEmbedding = Omit<ItemRow, 'embedding'>;

/** Lo que se envía al cliente de cada elemento. */
export function publicItem(item: ItemWithoutEmbedding & { embedding?: unknown }) {
  const { createdAt: _createdAt, embedding: _embedding, ...rest } = item;
  return rest;
}

/** Búsquedas por similitud coseno con pgvector, siempre dentro de un dominio. */
@Injectable()
export class ItemsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Catálogo de un dominio sin embeddings, para el ranking por atributos. */
  catalog(domainId: string): Promise<ItemWithoutEmbedding[]> {
    return this.db.select(itemColumns).from(items).where(eq(items.domainId, domainId));
  }

  /**
   * Los `limit` elementos más cercanos al vector, con su similitud coseno (0–1).
   * Usa el índice HNSW; `iterative_scan` evita quedarse corto al filtrar por dominio.
   */
  nearest(domainId: string, vector: number[], limit: number, excludeId?: string) {
    const distance = cosineDistance(items.embedding, vector);
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL hnsw.iterative_scan = relaxed_order`);
      await tx.execute(sql`SET LOCAL hnsw.ef_search = ${sql.raw(String(Math.max(40, limit * 2)))}`);
      const rows = await tx
        .select({ ...itemColumns, semantic: sql<number>`1 - (${distance})` })
        .from(items)
        .where(
          and(
            eq(items.domainId, domainId),
            isNotNull(items.embedding),
            excludeId ? ne(items.id, excludeId) : undefined,
          ),
        )
        .orderBy(asc(distance))
        .limit(limit);
      // relaxed_order puede devolverlos casi ordenados: se reordena aquí.
      return rows.sort((a, b) => b.semantic - a.semantic);
    });
  }

  /** Similitud coseno con el vector para unos elementos concretos (null si no tienen embedding). */
  async similarities(domainId: string, ids: string[], vector: number[]): Promise<Map<string, number | null>> {
    if (!ids.length) return new Map();
    const rows = await this.db
      .select({
        id: items.id,
        semantic: sql<
          number | null
        >`case when ${items.embedding} is null then null else 1 - (${cosineDistance(items.embedding, vector)}) end`,
      })
      .from(items)
      .where(and(eq(items.domainId, domainId), inArray(items.id, ids)));
    return new Map(rows.map((r) => [r.id, r.semantic === null ? null : Number(r.semantic)]));
  }

  /** Elementos parecidos a uno dado, del mismo dominio (para la Ficha). */
  async similar(id: string, limit: number) {
    const [item] = await this.db
      .select({ domainId: items.domainId, embedding: items.embedding })
      .from(items)
      .where(eq(items.id, id));
    if (!item) throw new NotFoundException('Elemento no encontrado');
    if (!item.embedding) return { itemId: id, items: [] };
    const rows = await this.nearest(item.domainId, item.embedding, limit, id);
    return {
      itemId: id,
      items: rows.map(({ semantic, ...row }) => ({
        similarity: round(Number(semantic)),
        item: publicItem(row),
      })),
    };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
