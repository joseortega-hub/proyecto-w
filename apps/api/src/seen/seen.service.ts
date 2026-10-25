import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { items, seenItems } from '../db/schema.js';
import { publicItem } from '../items/items.service.js';
import type { SeenRating } from '../taste/taste.engine.js';
import { TasteService } from '../taste/taste.service.js';
import { isSeenDomain, mergeMarks, type SeenMark, type SeenSource } from './seen.js';

/** Lo ya visto, leído, jugado o escuchado de cada persona anónima, por temática. */
@Injectable()
export class SeenService {
  private readonly logger = new Logger('Ya visto');

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly tastes: TasteService,
  ) {}

  /** Ids ya vistos (fuera de las recomendaciones). Sin persona o en otra temática, ninguno. */
  async ids(userId: string | null | undefined, domainId: string): Promise<Set<string>> {
    if (!userId || !isSeenDomain(domainId)) return new Set();
    const rows = await this.db
      .select({ itemId: seenItems.itemId })
      .from(seenItems)
      .where(and(eq(seenItems.userId, userId), eq(seenItems.domainId, domainId)));
    return new Set(rows.map((r) => r.itemId));
  }

  /** La sección «Ya visto»: lo marcado, de lo último a lo primero, con el elemento entero. */
  async list(userId: string, domainId: string) {
    this.check(domainId);
    const rows = await this.db
      .select({ item: items, rating: seenItems.rating, source: seenItems.source, seenAt: seenItems.updatedAt })
      .from(seenItems)
      .innerJoin(items, eq(items.id, seenItems.itemId))
      .where(and(eq(seenItems.userId, userId), eq(seenItems.domainId, domainId)))
      .orderBy(desc(seenItems.updatedAt));
    return {
      domainId,
      total: rows.length,
      entries: rows.map((r) => ({ item: publicItem(r.item), rating: r.rating, source: r.source, seenAt: r.seenAt.toISOString() })),
    };
  }

  /** Marca un elemento (o cambia su valoración). */
  async mark(userId: string, domainId: string, itemId: string, rating: SeenRating | null) {
    this.check(domainId);
    const [item] = await this.db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.domainId, domainId), eq(items.ownerId, '')));
    if (!item) throw new NotFoundException('Elemento no encontrado en esta temática');
    const [existing] = await this.db
      .select({ rating: seenItems.rating })
      .from(seenItems)
      .where(and(eq(seenItems.userId, userId), eq(seenItems.itemId, itemId)));
    const now = new Date();
    await this.db
      .insert(seenItems)
      .values({ userId, domainId, itemId, rating, source: 'app' })
      .onConflictDoUpdate({ target: [seenItems.userId, seenItems.itemId], set: { rating, updatedAt: now } });
    await this.tastes.rate(userId, domainId, [{ itemId, previous: existing?.rating ?? null, next: rating }]);
    return { itemId, rating, seen: true };
  }

  /** Quita la marca (y lo que su valoración enseñó al perfil). */
  async unmark(userId: string, domainId: string, itemId: string) {
    this.check(domainId);
    const [removed] = await this.db
      .delete(seenItems)
      .where(and(eq(seenItems.userId, userId), eq(seenItems.domainId, domainId), eq(seenItems.itemId, itemId)))
      .returning({ rating: seenItems.rating });
    if (removed?.rating) await this.tastes.rate(userId, domainId, [{ itemId, previous: removed.rating, next: null }]);
    return { itemId, rating: null, seen: false };
  }

  /** Marca varios a la vez (importación). Devuelve cuántos eran nuevos. */
  async markMany(userId: string, domainId: string, marks: SeenMark[], source: SeenSource): Promise<number> {
    this.check(domainId);
    if (!marks.length) return 0;
    const existingRows = await this.db
      .select({ itemId: seenItems.itemId, rating: seenItems.rating })
      .from(seenItems)
      .where(and(eq(seenItems.userId, userId), inArray(seenItems.itemId, marks.map((m) => m.itemId))));
    const merged = mergeMarks(new Map(existingRows.map((r) => [r.itemId, r.rating])), marks);
    const now = new Date();
    for (const m of merged) {
      await this.db
        .insert(seenItems)
        .values({ userId, domainId, itemId: m.itemId, rating: m.next, source })
        .onConflictDoUpdate({ target: [seenItems.userId, seenItems.itemId], set: { rating: m.next, updatedAt: now } });
    }
    await this.tastes.rate(userId, domainId, merged);
    const added = merged.filter((m) => m.isNew).length;
    this.logger.log(`${added} nuevos (${merged.length} en total) desde ${source} en ${domainId}`);
    return added;
  }

  private check(domainId: string) {
    if (!isSeenDomain(domainId)) throw new BadRequestException('Esta temática no tiene «ya visto»');
  }
}
