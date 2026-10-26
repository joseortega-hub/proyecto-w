import { Inject, Injectable, Logger } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { perreoReleases, perreoStats } from '../db/schema.js';
import { fold, type ArtistSummary } from './perreo.filters.js';
import { compareHistory, filterReleases, inPeriod, isCollab, normalizeCompare, yearsActive, rankHot, RELEASE_PERIODS, type CompareRow, type Period, type Release, type ReleasePeriod, type StatSnapshot } from './perreo.pulse.js';
import { PerreoService } from './perreo.service.js';

type StatRow = typeof perreoStats.$inferSelect;
type ReleaseRow = typeof perreoReleases.$inferSelect;

/** Novedades, lo más caliente y cara a cara: lee lo que precalcula `pnpm perreo:pulse` (nada de red en cada visita). */
@Injectable()
export class PerreoPulseService {
  private readonly logger = new Logger('Pulso');
  private cache: { releases: Release[]; stats: Map<string, StatSnapshot[]>; updated: string | null; at: number } | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly perreo: PerreoService,
  ) {}

  private async data() {
    if (this.cache && Date.now() - this.cache.at < 10 * 60_000) return this.cache;
    // Antes de la primera carga (o de la migración) las tablas pueden no estar: se devuelve vacío, sin romper el modo.
    const [releases, stats] = await Promise.all([
      this.db
        .select()
        .from(perreoReleases)
        .catch((e: Error) => (this.logger.warn(e.message), [] as ReleaseRow[])),
      this.db
        .select()
        .from(perreoStats)
        .orderBy(asc(perreoStats.day))
        .catch((e: Error) => (this.logger.warn(e.message), [] as StatRow[])),
    ]);
    const byArtist = new Map<string, StatSnapshot[]>();
    for (const s of stats) {
      const snap = { day: s.day, lastfmListeners: s.lastfmListeners, lastfmPlays: s.lastfmPlays, deezerFans: s.deezerFans, youtubeViews: s.youtubeViews, youtubeSubs: s.youtubeSubs, deezerAlbums: s.deezerAlbums, fame: s.fame, geo: s.geo };
      byArtist.set(s.artistSlug, [...(byArtist.get(s.artistSlug) ?? []), snap]);
    }
    const updated = stats.length ? stats[stats.length - 1].day : null;
    this.cache = { releases: releases.map((r) => ({ ...r, kind: r.kind as Release['kind'] })), stats: byArtist, updated, at: Date.now() };
    return this.cache;
  }

  private lite = (a: ArtistSummary) => ({ slug: a.slug, name: a.name, nickname: a.nickname ?? null, photoV: a.photoV ?? null, color: a.color ?? null, countries: a.countries, fame: a.fame });

  async releases(period: ReleasePeriod, kind?: 'album' | 'song', country?: string) {
    const [{ releases, updated }, artists] = await Promise.all([this.data(), this.perreo.visible()]);
    const bySlug = new Map(artists.map((a) => [a.slug, a]));
    const c = country ? fold(country) : '';
    const mine = releases.filter((r) => bySlug.has(r.artistSlug) && (!c || bySlug.get(r.artistSlug)!.countries.some((x) => fold(x) === c)));
    const counts = Object.fromEntries(RELEASE_PERIODS.map((p) => [p, { album: filterReleases(mine, p, 'album').length, song: filterReleases(mine, p, 'song').length }]));
    const list = filterReleases(mine, period, kind).slice(0, 80);
    return { period, kind: kind ?? null, updated, counts, releases: list.map((r) => ({ ...r, artist: this.lite(bySlug.get(r.artistSlug)!) })) };
  }

  async hot(period: Period, country?: string) {
    const [{ releases, stats, updated }, artists] = await Promise.all([this.data(), this.perreo.visible()]);
    const input = artists
      .filter((a) => a.kind === 'artist' || a.kind === 'group')
      .map((a) => ({ slug: a.slug, countries: a.countries, fame: a.fame, stats: stats.get(a.slug) ?? [], releases: releases.filter((r) => r.artistSlug === a.slug) }));
    const bySlug = new Map(artists.map((a) => [a.slug, a]));
    const entries = rankHot(input, { period, country, limit: 30 });
    // Países para el selector: los de los artistas y los del top de Last.fm con alguien dentro.
    const countries = new Map<string, number>();
    for (const a of input) for (const c of new Set([...a.countries, ...Object.keys(a.stats.at(-1)?.geo ?? {})])) countries.set(c, (countries.get(c) ?? 0) + 1);
    return {
      period,
      country: country ?? null,
      updated,
      countries: [...countries]
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count })),
      entries: entries.map((e) => ({ ...e, artist: this.lite(bySlug.get(e.slug)!) })),
    };
  }

  async compare(slugs: string[]) {
    const [{ releases, stats, updated }, artists] = await Promise.all([this.data(), this.perreo.visible()]);
    const picked = slugs.map((s) => artists.find((a) => a.slug === s)).filter((a): a is ArtistSummary => !!a);
    const facts = await this.perreo.versusFacts(picked.map((a) => a.slug));
    const rows: CompareRow[] = picked.map((a) => {
      const snaps = stats.get(a.slug) ?? [];
      const last = snaps.at(-1);
      const full = facts.get(a.slug);
      const years = yearsActive(a.debutYear, full?.artist.activeUntil ?? null);
      // Si el último día no trae un dato (fallo de una fuente), vale el más reciente que lo tenga.
      const latest = <K extends 'youtubeSubs' | 'deezerAlbums'>(k: K) => [...snaps].reverse().find((s) => s[k] != null)?.[k] ?? null;
      const albums = latest('deezerAlbums');
      const titles = full?.songTitles ?? [];
      return {
        slug: a.slug,
        values: {
          youtubeViews: last?.youtubeViews ?? null,
          youtubeSubs: latest('youtubeSubs'),
          lastfmListeners: last?.lastfmListeners ?? null,
          lastfmPlays: last?.lastfmPlays ?? null,
          deezerFans: last?.deezerFans ?? null,
          // Sin pulso no se sabe: mejor «sin dato» que un cero falso.
          releasesYear: last ? releases.filter((r) => r.artistSlug === a.slug && inPeriod(r.releaseDate, 'year')).length : null,
          topCountries: last ? Object.keys(last.geo).length : null,
          fame: Math.round(a.fame),
          streetLevel: a.streetLevel ?? null,
          yearsActive: years,
          deezerAlbums: albums,
          // Discos por año: el ritmo, justo entre un veterano y alguien que empieza.
          albumsPerYear: albums != null && years ? Math.round((albums / years) * 10) / 10 : null,
          catalogSongs: titles.length || null,
          collabs: titles.length ? titles.filter(isCollab).length : null,
        },
      };
    });
    const profiles = Object.fromEntries(
      picked.map((a) => {
        const full = facts.get(a.slug)?.artist;
        return [
          a.slug,
          {
            debutYear: a.debutYear,
            activeUntil: full?.activeUntil ?? null,
            status: full?.status ?? null,
            country: a.country,
            city: a.city,
            labels: a.labels.slice(0, 4),
            styles: a.styles.slice(0, 5),
            topIn: Object.entries(stats.get(a.slug)?.at(-1)?.geo ?? {})
              .sort((x, y) => x[1] - y[1])
              .slice(0, 3)
              .map(([country, rank]) => ({ country, rank })),
          },
        ];
      }),
    );
    const { history, days } = compareHistory(Object.fromEntries(picked.map((a) => [a.slug, stats.get(a.slug) ?? []])));
    return {
      updated,
      artists: picked.map(this.lite),
      values: Object.fromEntries(rows.map((r) => [r.slug, r.values])),
      profiles,
      history,
      historyDays: days,
      result: normalizeCompare(rows),
    };
  }
}
