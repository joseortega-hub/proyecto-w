import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, arrayOverlaps, asc, cosineDistance, desc, eq, getTableColumns, ilike, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { items, type ItemRow } from '../db/schema.js';
import type { FacetFilter } from '../interview/interview.engine.js';

/** Columnas de un elemento sin el embedding (768 números que no hacen falta fuera de pgvector). */
export const { embedding: _embedding, ...itemColumns } = getTableColumns(items);
export type ItemWithoutEmbedding = Omit<ItemRow, 'embedding'>;

/** Lo que se envía al cliente de cada elemento. */
export function publicItem(item: ItemWithoutEmbedding & { embedding?: unknown }) {
  const { createdAt: _createdAt, embedding: _embedding, ...rest } = item;
  return rest;
}

/**
 * Condición SQL para las preferencias previas: cada faceta debe tener uno de sus valores.
 * `?|` sirve tanto para un valor suelto (`"es"`) como para una lista (`["pc", "switch"]`).
 */
export const facetCondition = (filters: FacetFilter[] = []) =>
  filters.length
    ? and(
        ...filters.map(
          (f) =>
            sql`(${items.facets} -> ${f.key}) ?| array[${sql.join(
              f.values.map((v) => sql`${v}`),
              sql`, `,
            )}]::text[]`,
        ),
      )
    : undefined;

/**
 * Elementos que puede ver una persona: los públicos (sin dueño) y los suyos. Los de un
 * catálogo personal ("Mi YouTube") nunca salen de su dueño.
 */
export const visibleTo = (userId: string | null | undefined) => inArray(items.ownerId, userId ? ['', userId] : ['']);

/** Búsquedas por similitud coseno con pgvector, siempre dentro de un dominio. */
@Injectable()
export class ItemsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Catálogo de un dominio sin embeddings, para el ranking por atributos. */
  catalog(domainId: string, filters?: FacetFilter[], userId: string | null = null): Promise<ItemWithoutEmbedding[]> {
    return this.db
      .select(itemColumns)
      .from(items)
      .where(and(eq(items.domainId, domainId), visibleTo(userId), facetCondition(filters)));
  }

  /** Elementos concretos de un dominio (la bolsa de candidatas de una entrevista), sin embeddings. */
  byIds(domainId: string, ids: string[], userId: string | null = null): Promise<ItemWithoutEmbedding[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.db
      .select(itemColumns)
      .from(items)
      .where(and(eq(items.domainId, domainId), visibleTo(userId), inArray(items.id, ids)));
  }

  /**
   * Los `limit` elementos más cercanos al vector, con su similitud coseno (0–1).
   * Usa el índice HNSW; `iterative_scan` evita quedarse corto al filtrar por dominio.
   */
  nearest(
    domainId: string,
    vector: number[],
    limit: number,
    options: { excludeId?: string; filters?: FacetFilter[]; userId?: string | null } = {},
  ) {
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
            visibleTo(options.userId),
            isNotNull(items.embedding),
            options.excludeId ? ne(items.id, options.excludeId) : undefined,
            facetCondition(options.filters),
          ),
        )
        .orderBy(asc(distance))
        .limit(limit);
      // relaxed_order puede devolverlos casi ordenados: se reordena aquí.
      return rows.sort((a, b) => b.semantic - a.semantic);
    });
  }

  /** Similitud coseno con el vector para unos elementos concretos (null si no tienen embedding). */
  async similarities(domainId: string, ids: string[], vector: number[], userId: string | null = null): Promise<Map<string, number | null>> {
    if (!ids.length) return new Map();
    const rows = await this.db
      .select({
        id: items.id,
        semantic: sql<
          number | null
        >`case when ${items.embedding} is null then null else 1 - (${cosineDistance(items.embedding, vector)}) end`,
      })
      .from(items)
      .where(and(eq(items.domainId, domainId), visibleTo(userId), inArray(items.id, ids)));
    return new Map(rows.map((r) => [r.id, r.semantic === null ? null : Number(r.semantic)]));
  }

  /** Biblioteca de un dominio: búsqueda por título o autor y filtro por etiquetas, de más a menos popular. */
  async browse(domainId: string, options: { q?: string; tags?: string[]; offset: number; limit: number; userId?: string | null }) {
    const q = options.q?.trim().replace(/[%_\\]/g, (c) => `\\${c}`);
    const where = and(
      eq(items.domainId, domainId),
      visibleTo(options.userId),
      q ? or(ilike(items.title, `%${q}%`), ilike(items.subtitle, `%${q}%`)) : undefined,
      options.tags?.length ? arrayOverlaps(items.tags, options.tags) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select(itemColumns)
        .from(items)
        .where(where)
        .orderBy(desc(items.popularity), asc(items.title))
        .offset(options.offset)
        .limit(options.limit),
      this.db.select({ total: sql<number>`count(*)::int` }).from(items).where(where),
    ]);
    return { total, items: rows.map(publicItem) };
  }

  async get(id: string, userId: string | null = null) {
    const [item] = await this.db.select(itemColumns).from(items).where(and(eq(items.id, id), visibleTo(userId)));
    if (!item) throw new NotFoundException('Elemento no encontrado');
    return publicItem(item);
  }

  /** Elementos parecidos a uno dado, del mismo dominio (para la Ficha). */
  async similar(id: string, limit: number, userId: string | null = null) {
    const [item] = await this.db
      .select({ domainId: items.domainId, embedding: items.embedding })
      .from(items)
      .where(and(eq(items.id, id), visibleTo(userId)));
    if (!item) throw new NotFoundException('Elemento no encontrado');
    if (!item.embedding) return { itemId: id, items: [] };
    const rows = await this.nearest(item.domainId, item.embedding, limit, { excludeId: id, userId });
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
