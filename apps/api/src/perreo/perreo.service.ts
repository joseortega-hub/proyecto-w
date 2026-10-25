import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { items, perreoArtists, perreoReview } from '../db/schema.js';
import { publicItem } from '../items/items.service.js';
import { artistFacets, filterArtists, type ArtistQuery, type ArtistSummary } from './perreo.filters.js';

export const PERREO_DOMAIN = 'perreo';
const { photo: _photo, ...artistColumns } = getTableColumns(perreoArtists);
type Artist = Omit<typeof perreoArtists.$inferSelect, 'photo'>;

const summary = (a: Artist): ArtistSummary => ({
  slug: a.slug,
  name: a.name,
  country: a.country,
  city: a.city,
  countries: a.countries,
  debutYear: a.debutYear,
  fame: a.fame,
  styles: a.styles,
  labels: a.labels.map((l) => l.name),
  followed: a.followed,
  kind: a.kind,
  incomplete: a.incomplete,
});

/** Explorador de artistas del Modo Perreo: fichas, fotos y la primera lista de cada artista. */
@Injectable()
export class PerreoService {
  private cache: { rows: Artist[]; at: number } | null = null;

  constructor(@Inject(DB) private readonly db: Db) {}

  private async all() {
    if (this.cache && Date.now() - this.cache.at < 5 * 60_000) return this.cache.rows;
    const rows = await this.db.select(artistColumns).from(perreoArtists);
    this.cache = { rows, at: Date.now() };
    return rows;
  }

  async list(query: ArtistQuery) {
    const all = (await this.all()).map(summary);
    return { artists: filterArtists(all, query), total: all.length, followedTotal: all.filter((a) => a.followed).length, facets: artistFacets(all) };
  }

  async photo(slug: string): Promise<Buffer> {
    const [row] = await this.db.select({ photo: perreoArtists.photo }).from(perreoArtists).where(eq(perreoArtists.slug, slug));
    if (!row?.photo) throw new NotFoundException('Sin foto');
    return Buffer.from(row.photo, 'base64');
  }

  /** Canciones de varios artistas, las más conocidas primero. */
  private songs(slugs: string[], limit: number) {
    return this.db
      .select()
      .from(items)
      .where(and(eq(items.domainId, PERREO_DOMAIN), inArray(sql`${items.facets}->>'artist'`, slugs)))
      .orderBy(desc(items.popularity))
      .limit(limit);
  }

  /** Cuentas dudosas de la segunda pasada que esperan una decisión. */
  async pendingReview() {
    const rows = await this.db.select().from(perreoReview);
    return { pending: rows.filter((r) => r.status === 'pending'), accepted: rows.filter((r) => r.status === 'accepted').length, rejected: rows.filter((r) => r.status === 'rejected').length };
  }

  async decide(id: string, status: 'accepted' | 'rejected' | 'pending') {
    const done = await this.db.update(perreoReview).set({ status }).where(eq(perreoReview.id, id)).returning({ id: perreoReview.id });
    if (!done.length) throw new NotFoundException('Cuenta no encontrada');
    return { id, status };
  }

  /** Ficha: datos, parecidos y la primera lista (sus canciones y las de sus parecidos, intercaladas). */
  async get(slug: string) {
    const rows = await this.all();
    const artist = rows.find((r) => r.slug === slug);
    if (!artist) throw new NotFoundException('Artista no encontrado');
    const similar = artist.similar.map((s) => rows.find((r) => r.slug === s)).filter((r): r is Artist => !!r);
    const [own, other] = await Promise.all([
      this.songs([slug], 12),
      similar.length ? this.songs(similar.map((s) => s.slug), 60) : Promise.resolve([]),
    ]);
    return {
      artist,
      similar: similar.map(summary),
      alsoFollow: similar.filter((s) => s.followed).map(summary),
      firstList: [...own.slice(0, 8), ...interleave(other, 8)].map(publicItem),
    };
  }
}

/** Reparte `count` canciones entre sus artistas por turnos, para que no suene siempre el mismo. */
export function interleave<T extends { facets: Record<string, unknown> }>(songs: T[], count: number): T[] {
  const byArtist = new Map<string, T[]>();
  for (const s of songs) byArtist.set(String(s.facets.artist), [...(byArtist.get(String(s.facets.artist)) ?? []), s]);
  const out: T[] = [];
  for (let round = 0; out.length < count && round < count; round++) {
    for (const list of byArtist.values()) if (list[round] && out.length < count) out.push(list[round]);
  }
  return out;
}
