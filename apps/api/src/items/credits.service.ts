import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { lookupCredits } from '../catalog/musicbrainz.js';
import type { ItemDetails } from '../catalog/item-details.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { items } from '../db/schema.js';
import { visibleTo } from './items.service.js';

/**
 * Créditos de una canción desde MusicBrainz, bajo demanda: se piden al abrir la ficha y se
 * guardan en el elemento (también cuando no hay nada, para no repetir la consulta).
 */
@Injectable()
export class CreditsService {
  private readonly log = new Logger(CreditsService.name);
  private readonly inflight = new Map<string, Promise<ItemDetails>>();

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Detalles del elemento, completando los de MusicBrainz si es música y aún no se consultaron. */
  async details(id: string, userId: string | null): Promise<ItemDetails | null> {
    const [item] = await this.db
      .select({ domainId: items.domainId, title: items.title, subtitle: items.subtitle, details: items.details })
      .from(items)
      .where(and(eq(items.id, id), visibleTo(userId)));
    if (!item) return null;
    if (!['music', 'youtube'].includes(item.domainId) || item.details.musicbrainz) return item.details;
    const pending = this.inflight.get(id) ?? this.fetchAndStore(id, item.title, item.subtitle, item.details);
    this.inflight.set(id, pending);
    return pending.finally(() => this.inflight.delete(id));
  }

  private async fetchAndStore(id: string, title: string, artist: string | null, current: ItemDetails): Promise<ItemDetails> {
    try {
      const found = await lookupCredits(title, artist);
      const checked = { checkedAt: new Date().toISOString(), ...(found ? { mbid: found.mbid } : {}) };
      // Lo que ya traía la fuente (álbum de Jamendo) manda sobre lo de MusicBrainz.
      const merged: ItemDetails = { ...found?.details, ...current, musicbrainz: checked };
      await this.db.update(items).set({ details: sql`${items.details} || ${JSON.stringify(merged)}::jsonb` }).where(eq(items.id, id));
      return merged;
    } catch (err) {
      // Si MusicBrainz falla no se marca como consultado: se reintenta en la próxima visita.
      this.log.warn(`MusicBrainz: ${err instanceof Error ? err.message : err}`);
      return current;
    }
  }
}
