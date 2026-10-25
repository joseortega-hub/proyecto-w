// El pulso del Modo Perreo: pnpm perreo:pulse [--prod] [--limit N] [--only slug]
// Precalcula lo que no se debe pedir en cada visita y lo guarda en la BD:
//  - Novedades: discos y sencillos de Deezer (sin clave) y lo que está por salir de MusicBrainz (fechas futuras).
//  - Números del día: oyentes y reproducciones de Last.fm (LASTFM_API_KEY), fans de Deezer y visitas y
//    suscriptores del canal de YouTube (YOUTUBE_API_KEY; channels.list cuesta 1 unidad por cada 50 canales).
//  - Top de Last.fm por país (geo.getTopArtists): el puesto de cada artista en España, México, Colombia…
// Solo APIs oficiales y gratuitas, sin scraping. Cada respuesta se guarda en source_cache (20 h): repetirlo el
// mismo día no vuelve a pedir nada. Una foto de números por artista y día: con varias, sale el crecimiento.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { perreoArtists, perreoReleases, perreoStats, sourceCache } from '../db/schema.js';
import { fold } from './perreo.filters.js';
import { GEO_COUNTRIES } from './perreo.pulse.js';
import { sleep, USER_AGENT } from './perreo.sources.js';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const prod = process.argv.includes('--prod');
const target = prod ? process.env.PROD_DATABASE_URL?.trim() : undefined;
if (prod && !target) {
  console.error('Falta PROD_DATABASE_URL en el .env (cadena de conexión de Neon).');
  process.exit(1);
}
const limit = Number(arg('--limit') ?? 0) || Infinity;
const only = arg('--only');
const lastfmKey = config.lastfmApiKey?.trim() ?? '';
const youtubeKey = process.env.YOUTUBE_API_KEY?.trim() ?? '';
console.log(prod ? 'Base de datos: producción (Neon)' : 'Base de datos: local');
if (!lastfmKey) console.warn('Sin LASTFM_API_KEY: no habrá oyentes ni top por país.');
if (!youtubeKey) console.warn('Sin YOUTUBE_API_KEY: no habrá visitas de YouTube.');

const { db, client } = createDb(target ?? config.databaseUrl);
const TTL = 20 * 3600_000;
const gaps: Record<string, { gap: number; last: number }> = { deezer: { gap: 150, last: 0 }, mb: { gap: 1100, last: 0 }, lastfm: { gap: 250, last: 0 }, yt: { gap: 100, last: 0 } };

/** GET JSON con espera entre peticiones a cada servicio y caché en source_cache. Un fallo devuelve null y no se guarda. */
async function cachedJson<T>(service: keyof typeof gaps, key: string, url: string): Promise<T | null> {
  const [hit] = await db.select().from(sourceCache).where(eq(sourceCache.key, key));
  if (hit && Date.now() - hit.fetchedAt.getTime() < TTL) return hit.payload as T;
  const g = gaps[service];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const wait = g.last + g.gap - Date.now();
    if (wait > 0) await sleep(wait);
    g.last = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (res?.ok) {
      const json = (await res.json()) as T & { error?: unknown };
      // Deezer devuelve 200 con { error } cuando pasa la cuota: se reintenta.
      if (json && typeof json === 'object' && 'error' in json && service === 'deezer') {
        await sleep(2000 * attempt);
        continue;
      }
      await db.insert(sourceCache).values({ key, payload: json as never }).onConflictDoUpdate({ target: sourceCache.key, set: { payload: json as never, fetchedAt: new Date() } });
      return json;
    }
    if (res && res.status !== 429 && res.status < 500) return null;
    await sleep(1500 * attempt);
  }
  return null;
}

const today = new Date().toISOString().slice(0, 10);
const year = today.slice(0, 4);

try {
  await migrate(db, { migrationsFolder: resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle') });
  const all = await db
    .select({ slug: perreoArtists.slug, name: perreoArtists.name, kind: perreoArtists.kind, channel: perreoArtists.youtubeChannelId, aliases: perreoArtists.aliases })
    .from(perreoArtists)
    .where(and(eq(perreoArtists.incomplete, false), eq(perreoArtists.hidden, false), inArray(perreoArtists.kind, ['artist', 'group'])));
  const artists = all.filter((a) => !only || a.slug === only).slice(0, limit);
  console.log(`Artistas: ${artists.length}`);
  const byName = new Map(all.flatMap((a) => [a.name, ...a.aliases].map((n) => [fold(n), a.slug] as const)));

  // 1) Top de Last.fm por país.
  const geo = new Map<string, Record<string, number>>();
  if (lastfmKey) {
    for (const [es, en] of Object.entries(GEO_COUNTRIES)) {
      const top = await cachedJson<{ topartists?: { artist?: { name: string }[] } }>('lastfm', `perreo:geo:${en}:${today}`, `https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method: 'geo.gettopartists', country: en, limit: '200', api_key: lastfmKey, format: 'json' })}`);
      let found = 0;
      (top?.topartists?.artist ?? []).forEach((a, i) => {
        const slug = byName.get(fold(a.name));
        if (!slug) return;
        geo.set(slug, { ...(geo.get(slug) ?? {}), [es]: i + 1 });
        found++;
      });
      console.log(`  Top ${es}: ${found} del Modo Perreo`);
    }
  }

  // 2) Visitas y suscriptores de YouTube, de 50 en 50 canales.
  const yt = new Map<string, { views: number | null; subs: number | null }>();
  const channels = artists.filter((a) => a.channel);
  if (youtubeKey) {
    for (let i = 0; i < channels.length; i += 50) {
      const batch = channels.slice(i, i + 50);
      const ids = batch.map((a) => a.channel!).join(',');
      const res = await cachedJson<{ items?: { id: string; statistics?: { viewCount?: string; subscriberCount?: string } }[] }>('yt', `perreo:yt:${today}:${i}:${batch.length}`, `https://www.googleapis.com/youtube/v3/channels?${new URLSearchParams({ part: 'statistics', id: ids, key: youtubeKey })}`);
      for (const item of res?.items ?? []) {
        const a = batch.find((x) => x.channel === item.id);
        if (a) yt.set(a.slug, { views: Number(item.statistics?.viewCount) || null, subs: Number(item.statistics?.subscriberCount) || null });
      }
    }
    console.log(`YouTube: ${yt.size} canales (${Math.ceil(channels.length / 50)} unidades de cuota)`);
  }

  // 3) Por artista: Last.fm, Deezer (fans y lanzamientos) y MusicBrainz (lo que viene).
  let releases = 0;
  for (const [n, a] of artists.entries()) {
    const info = lastfmKey
      ? await cachedJson<{ artist?: { mbid?: string; stats?: { listeners?: string; playcount?: string } } }>('lastfm', `perreo:lfm:${a.slug}:${today}`, `https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method: 'artist.getinfo', artist: a.name, autocorrect: '1', api_key: lastfmKey, format: 'json' })}`)
      : null;
    const search = await cachedJson<{ data?: { id: number; name: string; nb_fan: number }[] }>('deezer', `perreo:dz:search:${a.slug}:${today}`, `https://api.deezer.com/search/artist?${new URLSearchParams({ q: a.name, limit: '5' })}`);
    // Solo el nombre exacto: un homónimo daría números de otra persona.
    const dz = (search?.data ?? []).filter((d) => fold(d.name) === fold(a.name)).sort((x, y) => y.nb_fan - x.nb_fan)[0];
    const rows: (typeof perreoReleases.$inferInsert)[] = [];
    if (dz) {
      const albums = await cachedJson<{ data?: { id: number; title: string; cover_medium?: string; release_date?: string; record_type?: string; fans?: number; link?: string }[] }>('deezer', `perreo:dz:albums:${dz.id}:${today}`, `https://api.deezer.com/artist/${dz.id}/albums?limit=60`);
      for (const al of albums?.data ?? []) {
        if (!al.release_date || al.release_date < `${Number(year) - 1}-01-01`) continue;
        rows.push({ id: `deezer:${al.id}`, artistSlug: a.slug, kind: al.record_type === 'single' ? 'song' : 'album', recordType: al.record_type ?? null, title: al.title, releaseDate: al.release_date, coverUrl: al.cover_medium ?? null, link: al.link ?? `https://www.deezer.com/album/${al.id}`, source: 'deezer', fans: al.fans ?? null, updatedAt: new Date() });
      }
    }
    const mbid = info?.artist?.mbid;
    if (mbid) {
      const rg = await cachedJson<{ 'release-groups'?: { id: string; title: string; 'first-release-date'?: string; 'primary-type'?: string }[] }>('mb', `perreo:mb:rg:${mbid}:${today}`, `https://musicbrainz.org/ws/2/release-group?${new URLSearchParams({ artist: mbid, fmt: 'json', limit: '100' })}`);
      for (const g of rg?.['release-groups'] ?? []) {
        const date = g['first-release-date'] ?? '';
        // De MusicBrainz, lo de este año y lo que viene (Deezer cubre mejor lo ya publicado).
        if (!date || date.slice(0, 4) < year) continue;
        const type = (g['primary-type'] ?? '').toLowerCase();
        if (!['album', 'ep', 'single'].includes(type)) continue;
        rows.push({ id: `mb:${g.id}`, artistSlug: a.slug, kind: type === 'single' ? 'song' : 'album', recordType: type, title: g.title, releaseDate: date, coverUrl: null, link: `https://musicbrainz.org/release-group/${g.id}`, source: 'musicbrainz', fans: null, updatedAt: new Date() });
      }
    }
    for (const r of rows) await db.insert(perreoReleases).values(r).onConflictDoUpdate({ target: perreoReleases.id, set: r });
    releases += rows.length;
    const stat = {
      artistSlug: a.slug,
      day: today,
      lastfmListeners: Number(info?.artist?.stats?.listeners) || null,
      lastfmPlays: Number(info?.artist?.stats?.playcount) || null,
      deezerFans: dz?.nb_fan ?? null,
      youtubeViews: yt.get(a.slug)?.views ?? null,
      youtubeSubs: yt.get(a.slug)?.subs ?? null,
      geo: geo.get(a.slug) ?? {},
    };
    await db.insert(perreoStats).values(stat).onConflictDoUpdate({ target: [perreoStats.artistSlug, perreoStats.day], set: stat });
    if ((n + 1) % 25 === 0) console.log(`  ${n + 1}/${artists.length} · ${releases} lanzamientos`);
  }
  console.log(`Listo: ${artists.length} artistas, ${releases} lanzamientos (desde ${Number(year) - 1} y lo próximo). Repítelo otro día para ver el crecimiento.`);
} finally {
  await client.end();
}
