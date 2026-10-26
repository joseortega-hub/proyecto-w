import { lookup } from 'node:dns/promises';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { and, desc, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { items, perreoArtists, perreoReview } from '../db/schema.js';
import { publicItem } from '../items/items.service.js';
import { upsertItems } from '../catalog/upsert.js';
import { isPrivateHost, planEdit, youtubeId, type ArtistPatch } from './perreo.edit.js';
import { artistColor } from './perreo.color.js';
import { artistFacets, filterArtists, type ArtistQuery, type ArtistSummary } from './perreo.filters.js';

export const PERREO_DOMAIN = 'perreo';
const { photo: _photo, ...tableColumns } = getTableColumns(perreoArtists);
// La foto no viaja con la ficha, solo una huella: la web la pone en la URL y, al cambiar la foto, el navegador pide la nueva.
const artistColumns = { ...tableColumns, photoV: sql<string | null>`left(md5(${perreoArtists.photo}), 10)` };
type Artist = Omit<typeof perreoArtists.$inferSelect, 'photo'> & { photoV: string | null };

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
  nickname: a.nickname,
  photoV: a.photoV,
  aliases: a.aliases,
  streetLevel: a.streetLevel,
  status: a.status,
  color: a.color,
  favorite: a.favoriteRank,
});

/** Explorador de artistas del Modo Perreo: fichas, fotos y la primera lista de cada artista. */
@Injectable()
export class PerreoService {
  private cache: { rows: Artist[]; at: number } | null = null;
  private coloring: Promise<void> | null = null;

  constructor(@Inject(DB) private readonly db: Db) {}

  private async all() {
    if (this.cache && Date.now() - this.cache.at < 5 * 60_000) return this.cache.rows;
    const rows = await this.db.select(artistColumns).from(perreoArtists);
    this.cache = { rows, at: Date.now() };
    if (rows.some((r) => !r.color) && !this.coloring) this.coloring = this.fillColors().finally(() => (this.coloring = null));
    return rows;
  }

  /** Calcula (una vez) el color de los artistas que no lo tienen: el más vivo de su foto o el de su subgénero. */
  private async fillColors() {
    const missing = await this.db.select({ slug: perreoArtists.slug, styles: perreoArtists.styles, photo: perreoArtists.photo }).from(perreoArtists).where(isNull(perreoArtists.color));
    for (const m of missing) {
      const color = await artistColor(m.slug, m.styles, m.photo);
      await this.db.update(perreoArtists).set({ color }).where(eq(perreoArtists.slug, m.slug));
      const row = this.cache?.rows.find((r) => r.slug === m.slug);
      if (row) row.color = color;
    }
  }

  /** Los que se enseñan: sin fichas mínimas («por completar») ni ocultos. */
  async visible(): Promise<ArtistSummary[]> {
    return (await this.all()).filter((a) => !a.incomplete && !a.hidden).map(summary);
  }

  async list(query: ArtistQuery) {
    // Las fichas mínimas (solo usuario de Instagram, sin foto ni datos) no se enseñan en el explorador hasta completarlas.
    const all = await this.visible();
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

  /** Para el 1 vs 1: la ficha completa de cada uno y los títulos de sus canciones en el catálogo. */
  async versusFacts(slugs: string[]) {
    const rows = (await this.all()).filter((r) => slugs.includes(r.slug));
    const songs = slugs.length
      ? await this.db
          .select({ title: items.title, artist: sql<string>`${items.facets}->>'artist'` })
          .from(items)
          .where(and(eq(items.domainId, PERREO_DOMAIN), inArray(sql`${items.facets}->>'artist'`, slugs)))
      : [];
    return new Map(rows.map((r) => [r.slug, { artist: r, songTitles: songs.filter((s) => s.artist === r.slug).map((s) => s.title) }]));
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
    // El color hace falta ya (desbloqueo): si aún no está calculado, se calcula ahora.
    if (!artist.color) {
      const [p] = await this.db.select({ photo: perreoArtists.photo }).from(perreoArtists).where(eq(perreoArtists.slug, slug));
      artist.color = await artistColor(slug, artist.styles, p?.photo ?? null);
      await this.db.update(perreoArtists).set({ color: artist.color }).where(eq(perreoArtists.slug, slug));
    }
    const similar = artist.similar.map((s) => rows.find((r) => r.slug === s)).filter((r): r is Artist => !!r && !r.hidden);
    const [own, other, featured] = await Promise.all([
      this.songs([slug], 40),
      similar.length ? this.songs(similar.map((s) => s.slug), 60) : Promise.resolve([]),
      artist.featuredVideoId ? this.song(artist.featuredVideoId) : Promise.resolve(null),
    ]);
    // La canción destacada va la primera; las demás, por popularidad.
    const ownAll = featured ? [featured, ...own.filter((s) => s.id !== featured.id)] : own;
    return {
      artist,
      ownSongs: ownAll.map((s) => ({ videoId: s.externalId, title: s.title })),
      similar: similar.map(summary),
      // Grupo ↔ miembros (de la ficha ampliada de los favoritos).
      members: (artist.profile.members ?? []).flatMap((s) => rows.filter((r) => r.slug === s && !r.hidden)).map(summary),
      memberOf: (artist.profile.memberOf ?? []).flatMap((s) => rows.filter((r) => r.slug === s && !r.hidden)).map(summary),
      alsoFollow: similar.filter((s) => s.followed).map(summary),
      firstList: [...ownAll.slice(0, 8), ...interleave(other, 8)].map(publicItem),
    };
  }

  private async song(videoId: string) {
    const [row] = await this.db.select().from(items).where(and(eq(items.domainId, PERREO_DOMAIN), eq(items.source, 'youtube'), eq(items.externalId, videoId), eq(items.ownerId, '')));
    return row ?? null;
  }

  /** Guarda lo editado a mano y apunta qué campos son manuales, para que las recargas no los pisen. */
  async edit(slug: string, patch: ArtistPatch) {
    const [cur] = await this.db.select(artistColumns).from(perreoArtists).where(eq(perreoArtists.slug, slug));
    if (!cur) throw new NotFoundException('Artista no encontrado');
    const { set, manual } = planEdit(cur, patch);
    if (patch.photoUrl || patch.photoData) {
      const raw = patch.photoData ? Buffer.from(patch.photoData, 'base64') : await this.download(patch.photoUrl!);
      try {
        const webp = await sharp(raw, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 480, height: 480, fit: 'cover', position: 'top' }).webp({ quality: 70 }).toBuffer();
        set.photo = webp.toString('base64');
      } catch {
        throw new BadRequestException('No he podido leer esa imagen');
      }
      // Foto nueva → color nuevo (salvo que lo hayas elegido tú).
      if (!manual.has('color')) set.color = await artistColor(cur.slug, (set.styles as string[] | undefined) ?? cur.styles, set.photo as string);
      manual.add('photo');
    }
    if (patch.featured !== undefined) {
      if (patch.featured === null || !patch.featured.trim()) set.featuredVideoId = null;
      else {
        const id = youtubeId(patch.featured);
        if (!id) throw new BadRequestException('Ese enlace de YouTube no vale');
        await this.ensureSong(id, cur.slug, patch.name ?? cur.name);
        set.featuredVideoId = id;
      }
    }
    if (!Object.keys(set).length) return this.get(slug);
    set.manualFields = [...manual];
    await this.db.update(perreoArtists).set(set).where(eq(perreoArtists.slug, slug));
    this.cache = null;
    return this.get(slug);
  }

  /** Descarga una foto por enlace (solo http(s) públicos, sin redirecciones a la red interna, hasta 6 MB). */
  private async download(link: string): Promise<Buffer> {
    let target = link;
    for (let hop = 0; hop < 4; hop++) {
      const u = new URL(target);
      if (!/^https?:$/.test(u.protocol) || isPrivateHost(u.hostname)) throw new BadRequestException('Ese enlace de foto no vale');
      const addrs = await lookup(u.hostname, { all: true }).catch(() => []);
      if (!addrs.length || addrs.some((a) => isPrivateHost(a.address))) throw new BadRequestException('Ese enlace de foto no vale');
      const res = await fetch(u, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'Sintonia/1.0' } }).catch(() => null);
      if (!res) throw new BadRequestException('No he podido bajar la foto');
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        target = new URL(res.headers.get('location')!, u).toString();
        continue;
      }
      if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) throw new BadRequestException('Ese enlace no es una imagen');
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 6_000_000) throw new BadRequestException('La imagen pesa demasiado');
      return buf;
    }
    throw new BadRequestException('Demasiadas redirecciones');
  }

  /** Si el vídeo no está en el catálogo, lo añade con su título (oEmbed de YouTube, sin clave). */
  private async ensureSong(videoId: string, artistSlug: string, artistName: string) {
    if (await this.song(videoId)) return;
    const meta = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ title?: string }>) : null))
      .catch(() => null);
    if (!meta) throw new BadRequestException('No encuentro ese vídeo en YouTube');
    await upsertItems(this.db, PERREO_DOMAIN, [
      {
        source: 'youtube',
        externalId: videoId,
        ownerId: '',
        title: (meta.title ?? 'Canción destacada').slice(0, 200),
        subtitle: artistName,
        description: null,
        imageUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        mediaUrl: `https://www.youtube.com/watch?v=${videoId}`,
        externalUrl: `https://music.youtube.com/watch?v=${videoId}`,
        durationSec: null,
        attributes: {},
        tags: [],
        facets: { artist: artistSlug },
        popularity: 1,
        details: {},
      },
    ]);
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
