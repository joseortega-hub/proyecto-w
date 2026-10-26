// Ficha completa de los favoritos del Modo Perreo: pnpm perreo:favorites [--only slug] [--no-songs]
// Lee data/privado/perreo/favoritos.json (nombres en orden) y, para cada uno, junta todas las fuentes legales y gratuitas:
//  - MusicBrainz (1 petición/s): MBID, Wikidata, discografía con fechas (release groups) y grupos ↔ miembros.
//  - Wikidata: nacimiento, lugar de nacimiento y origen, años en activo, sellos, premios, alias y redes.
//  - Last.fm (LASTFM_API_KEY): oyentes, reproducciones, etiquetas, parecidos y canciones más escuchadas.
//  - Deezer (sin clave): fans, número de discos, discos con fecha, top de canciones y colaboradores.
//  - YouTube Data API (YOUTUBE_API_KEY): canal (search.list solo una vez si no hay otra forma), suscriptores,
//    visitas y los vídeos más vistos (playlistItems + videos.list, 1 unidad por página de 50).
// Cada respuesta se guarda en source_cache de la BD local (7 días): repetirlo no gasta cupo. Una fuente que falla o se
// agota deja su parte vacía y el resto sigue, sin reintentos en bucle. Salidas: favorites.json (fichas) y fav-songs.json
// (varias canciones por favorito, analizadas con Groq). Después: pnpm perreo:load [--prod].
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import {
  createGroqClient,
  GroqTextProvider,
} from '../ai/groq/groq.providers.js';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { sourceCache } from '../db/schema.js';
import { enrichSongs, ENRICH_BATCH } from '../youtube/youtube.enrich.js';
import {
  favoriteRanks,
  linkGroups,
  readFavorites,
} from './perreo.favorites.js';
import { fold } from './perreo.filters.js';
import { countryName } from './perreo.sources.ig.js';
import { cleanTitle, sleep, songKey, USER_AGENT } from './perreo.sources.js';
import type {
  PerreoArtistFile,
  PerreoProfile,
  PerreoSongFile,
  ProfileRelease,
} from './perreo.types.js';

const args = process.argv.slice(2);
const arg = (name: string) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
const dir = join(root, 'data', 'privado', 'perreo');
const readJson = <T>(file: string, fallback: T): T =>
  existsSync(join(dir, file))
    ? (JSON.parse(readFileSync(join(dir, file), 'utf8')) as T)
    : fallback;
const writeJson = (file: string, data: unknown) =>
  writeFileSync(join(dir, file), JSON.stringify(data, null, 1));
const lastfmKey = config.lastfmApiKey?.trim() ?? '';
const youtubeKey = process.env.YOUTUBE_API_KEY?.trim() ?? '';
const SONGS_PER_FAVORITE = 25;
const TOP_VIDEOS = 15;

const artists = [
  ...readJson<PerreoArtistFile[]>('artists.json', []),
  ...readJson<PerreoArtistFile[]>('ig-artists.json', []),
];
const ranks = favoriteRanks(readFavorites(dir), artists);
const favorites = [...ranks.keys()]
  .map((slug) => artists.find((a) => a.slug === slug)!)
  .filter((a) => !arg('--only') || a.slug === arg('--only'));
if (!favorites.length) {
  console.error(
    'No hay favoritos: crea data/privado/perreo/favoritos.json con un array de nombres en orden (["Wisin", "Yandel", …]).',
  );
  process.exit(1);
}
console.log(`Favoritos: ${favorites.map((a) => a.name).join(', ')}`);
if (!lastfmKey)
  console.warn('Sin LASTFM_API_KEY: sin oyentes ni etiquetas de Last.fm.');
if (!youtubeKey)
  console.warn(
    'Sin YOUTUBE_API_KEY: sin datos del canal ni vídeos más vistos.',
  );

const { db, client } = createDb(config.databaseUrl);
const TTL = 7 * 24 * 3600_000;
const gaps = {
  mb: { gap: 1100, last: 0 },
  wd: { gap: 600, last: 0 },
  lastfm: { gap: 250, last: 0 },
  deezer: { gap: 200, last: 0 },
  yt: { gap: 100, last: 0 },
};
/** Fuentes que se agotaron (429, cuota): no se insiste más en esta ejecución. */
const exhausted = new Set<keyof typeof gaps>();

/** GET JSON con ritmo por servicio y caché en source_cache. Un fallo devuelve null; una cuota agotada apaga esa fuente. */
async function cachedJson<T>(
  service: keyof typeof gaps,
  key: string,
  url: string,
): Promise<T | null> {
  const [hit] = await db
    .select()
    .from(sourceCache)
    .where(eq(sourceCache.key, key));
  if (hit && Date.now() - hit.fetchedAt.getTime() < TTL)
    return hit.payload as T;
  if (exhausted.has(service)) return null;
  const g = gaps[service];
  const wait = g.last + g.gap - Date.now();
  if (wait > 0) await sleep(wait);
  g.last = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) {
    if (res && (res.status === 429 || res.status === 403)) {
      exhausted.add(service);
      console.warn(
        `  ${service}: cupo agotado o acceso denegado (${res.status}); sigo con las demás fuentes.`,
      );
    }
    return null;
  }
  const json = (await res.json()) as T & { error?: unknown };
  if (json && typeof json === 'object' && 'error' in json && json.error) {
    // Deezer (y Last.fm) responden 200 con { error } al pasarse de cupo.
    if (service === 'deezer' || service === 'lastfm') exhausted.add(service);
    return null;
  }
  await db
    .insert(sourceCache)
    .values({ key, payload: json as never })
    .onConflictDoUpdate({
      target: sourceCache.key,
      set: { payload: json as never, fetchedAt: new Date() },
    });
  return json;
}

const MB = 'https://musicbrainz.org/ws/2';
type MbRel = {
  type: string;
  direction?: string;
  artist?: { id: string; name: string };
  url?: { resource: string };
};
type MbBody = {
  id: string;
  name: string;
  type?: string;
  tags?: { name: string }[];
  relations?: MbRel[];
};

/** MusicBrainz: el de nombre exacto que enlaza su canal o su Instagram; si no, el primero con nombre exacto. */
async function musicbrainz(a: PerreoArtistFile): Promise<MbBody | null> {
  const found = await cachedJson<{
    artists?: { id: string; name: string; score: number }[];
  }>(
    'mb',
    `fav:mb:search:${a.slug}`,
    `${MB}/artist?${new URLSearchParams({ query: `artist:"${a.name.replace(/"/g, '')}"`, limit: '5', fmt: 'json' })}`,
  );
  const exact = (found?.artists ?? []).filter(
    (x) =>
      x.score >= 85 &&
      fold(x.name).replace(/&/g, 'y') === fold(a.name).replace(/&/g, 'y'),
  );
  const ig = a.links.instagram?.toLowerCase().split('/').filter(Boolean).pop();
  let first: MbBody | null = null;
  for (const hit of exact.slice(0, 3)) {
    const body = await cachedJson<MbBody>(
      'mb',
      `fav:mb:artist:${hit.id}`,
      `${MB}/artist/${hit.id}?inc=url-rels+artist-rels+tags&fmt=json`,
    );
    if (!body) continue;
    first ??= body;
    const urls = (body.relations ?? []).map(
      (r) => r.url?.resource.toLowerCase() ?? '',
    );
    if (
      urls.some(
        (u) =>
          (a.youtubeChannelId &&
            u.includes(a.youtubeChannelId.toLowerCase())) ||
          (ig && u.includes(`instagram.com/${ig}`)),
      )
    )
      return body;
  }
  return first;
}

/** Discografía completa de MusicBrainz (release groups con su primera fecha), hasta 300. */
async function mbDiscography(mbid: string): Promise<ProfileRelease[]> {
  const out: ProfileRelease[] = [];
  for (let offset = 0; offset < 300; offset += 100) {
    const page = await cachedJson<{
      'release-group-count'?: number;
      'release-groups'?: {
        title: string;
        'primary-type'?: string;
        'secondary-types'?: string[];
        'first-release-date'?: string;
      }[];
    }>(
      'mb',
      `fav:mb:rg:${mbid}:${offset}`,
      `${MB}/release-group?${new URLSearchParams({ artist: mbid, limit: '100', offset: String(offset), fmt: 'json' })}`,
    );
    for (const rg of page?.['release-groups'] ?? []) {
      // Recopilatorios y directos fuera: la discografía es la propia.
      if (
        rg['secondary-types']?.some((t) =>
          /compilation|live|dj-mix|mixtape|remix/i.test(t),
        )
      )
        continue;
      out.push({
        title: rg.title,
        type: (rg['primary-type'] ?? 'other').toLowerCase(),
        date: rg['first-release-date'] || null,
      });
    }
    if (!page || offset + 100 >= (page['release-group-count'] ?? 0)) break;
  }
  return out.sort((x, y) => (y.date ?? '').localeCompare(x.date ?? ''));
}

type Snak = {
  mainsnak?: { datavalue?: { value?: unknown } };
  qualifiers?: Record<string, { datavalue?: { value?: unknown } }[]>;
};
type WdEntity = {
  claims?: Record<string, Snak[]>;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
};
const SOCIALS: Record<string, [string, (v: string) => string]> = {
  P2003: ['instagram', (v) => `https://www.instagram.com/${v}`],
  P2002: ['x', (v) => `https://x.com/${v}`],
  P7085: ['tiktok', (v) => `https://www.tiktok.com/@${v}`],
  P2013: ['facebook', (v) => `https://www.facebook.com/${v}`],
  P1902: ['spotify', (v) => `https://open.spotify.com/artist/${v}`],
  P856: ['web', (v) => v],
};

/** Wikidata: nacimiento, lugares, años en activo, sellos, premios, alias, redes y miembros (P527) del grupo. */
async function wikidata(qid: string) {
  const api = (key: string, params: Record<string, string>) =>
    cachedJson<{ entities?: Record<string, WdEntity> }>(
      'wd',
      key,
      `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', format: 'json', ...params })}`,
    );
  const e = (
    await api(`fav:wd:${qid}`, {
      ids: qid,
      props: 'claims|aliases|labels',
      languages: 'es|en',
    })
  )?.entities?.[qid];
  if (!e) return null;
  const claims = e.claims ?? {};
  const values = (p: string) =>
    (claims[p] ?? [])
      .map((c) => c.mainsnak?.datavalue?.value)
      .filter((v) => v != null);
  const ids = (p: string) =>
    values(p).flatMap((v) =>
      typeof v === 'object' && v && 'id' in v
        ? [String((v as { id: string }).id)]
        : [],
    );
  const str = (p: string) =>
    values(p).find((v): v is string => typeof v === 'string') ?? null;
  const year = (p: string) => {
    const v = values(p).find(
      (x) => typeof x === 'object' && x && 'time' in x,
    ) as { time: string } | undefined;
    return v ? Number(v.time.replace(/^\+/, '').slice(0, 4)) || null : null;
  };
  const birth = values('P569').find(
    (x) => typeof x === 'object' && x && 'time' in x,
  ) as { time: string; precision: number } | undefined;
  const wanted = [
    ...new Set(['P19', 'P740', 'P264', 'P166', 'P527', 'P27'].flatMap(ids)),
  ].slice(0, 50);
  const labels = wanted.length
    ? (
        await api(`fav:wd:labels:${qid}:${wanted.length}`, {
          ids: wanted.join('|'),
          props: 'labels',
          languages: 'es|en',
        })
      )?.entities
    : undefined;
  const label = (id: string) =>
    labels?.[id]?.labels?.es?.value ?? labels?.[id]?.labels?.en?.value ?? null;
  const names = (p: string) => [
    ...new Set(ids(p).flatMap((id) => label(id) ?? [])),
  ];
  const socials: Record<string, string> = {};
  for (const [p, [k, url]] of Object.entries(SOCIALS)) {
    const v = str(p);
    if (v) socials[k] = url(v);
  }
  return {
    birthDate:
      birth && birth.precision >= 11
        ? birth.time.replace(/^\+/, '').slice(0, 10)
        : null,
    birthPlace: names('P19')[0] ?? null,
    origin: names('P740')[0] ?? null,
    country: names('P27').map(countryName)[0] ?? null,
    activeFrom: year('P2031') ?? year('P571'),
    activeTo: year('P2032') ?? year('P576'),
    labels: names('P264'),
    awards: names('P166'),
    aliases: [
      ...new Set(
        [...(e.aliases?.es ?? []), ...(e.aliases?.en ?? [])].map(
          (x) => x.value,
        ),
      ),
    ].slice(0, 8),
    socials,
    channelId: str('P2397'),
    members: names('P527'),
  };
}

/** Last.fm: estadísticas, etiquetas, parecidos y más escuchadas (con reproducciones). */
async function lastfm(name: string) {
  if (!lastfmKey) return null;
  const call = <T>(method: string, extra: Record<string, string> = {}) =>
    cachedJson<T>(
      'lastfm',
      `fav:lfm:${method}:${fold(name)}`,
      `https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method, artist: name, autocorrect: '1', api_key: lastfmKey, format: 'json', ...extra })}`,
    );
  const info = await call<{
    artist?: {
      stats?: { listeners?: string; playcount?: string };
      tags?: { tag?: { name: string }[] };
      similar?: { artist?: { name: string }[] };
    };
  }>('artist.getinfo');
  const top = await call<{
    toptracks?: { track?: { name: string; playcount?: string }[] };
  }>('artist.gettoptracks', { limit: '50' });
  if (!info?.artist) return null;
  return {
    listeners: Number(info.artist.stats?.listeners) || null,
    playcount: Number(info.artist.stats?.playcount) || null,
    tags: (info.artist.tags?.tag ?? []).map((t) => t.name),
    similar: (info.artist.similar?.artist ?? []).map((x) => x.name),
    topTracks: (top?.toptracks?.track ?? []).map((t) => t.name),
  };
}

/** Deezer (sin clave): el de nombre exacto con más fans, sus discos con fecha, top de canciones y colaboradores. */
async function deezer(name: string) {
  const found = await cachedJson<{
    data?: { id: number; name: string; nb_fan: number }[];
  }>(
    'deezer',
    `fav:dz:search:${fold(name)}`,
    `https://api.deezer.com/search/artist?${new URLSearchParams({ q: name, limit: '5' })}`,
  );
  const key = fold(name)
    .replace(/&/g, 'y')
    .replace(/[^a-z0-9]/g, '');
  const hit = (found?.data ?? [])
    .filter(
      (x) =>
        fold(x.name)
          .replace(/&/g, 'y')
          .replace(/[^a-z0-9]/g, '') === key,
    )
    .sort((x, y) => y.nb_fan - x.nb_fan)[0];
  if (!hit) return null;
  const artist = await cachedJson<{
    nb_fan?: number;
    nb_album?: number;
    link?: string;
  }>(
    'deezer',
    `fav:dz:artist:${hit.id}`,
    `https://api.deezer.com/artist/${hit.id}`,
  );
  const top = await cachedJson<{
    data?: { title: string; contributors?: { name: string }[] }[];
  }>(
    'deezer',
    `fav:dz:top:${hit.id}`,
    `https://api.deezer.com/artist/${hit.id}/top?limit=50`,
  );
  const albums = await cachedJson<{
    data?: { title: string; release_date?: string; record_type?: string }[];
  }>(
    'deezer',
    `fav:dz:albums:${hit.id}`,
    `https://api.deezer.com/artist/${hit.id}/albums?limit=100`,
  );
  const count = new Map<string, number>();
  for (const t of top?.data ?? [])
    for (const c of t.contributors ?? [])
      if (fold(c.name) !== fold(hit.name))
        count.set(c.name, (count.get(c.name) ?? 0) + 1);
  return {
    id: hit.id,
    fans: artist?.nb_fan ?? hit.nb_fan ?? null,
    albums: artist?.nb_album ?? null,
    link: artist?.link ?? `https://www.deezer.com/artist/${hit.id}`,
    topTracks: (top?.data ?? []).map((t) => t.title),
    collaborators: [...count.entries()]
      .sort((x, y) => y[1] - x[1])
      .map(([n]) => n)
      .slice(0, 12),
    releases: (albums?.data ?? []).map((x): ProfileRelease => ({
      title: x.title,
      type: (x.record_type ?? 'album').toLowerCase(),
      date: x.release_date ?? null,
    })),
  };
}

/** YouTube: datos del canal y los vídeos más vistos de sus subidas (hasta 200, ~8 unidades). */
async function youtube(a: PerreoArtistFile, channelHint: string | null) {
  if (!youtubeKey) return null;
  let channelId = a.youtubeChannelId ?? channelHint;
  if (!channelId) {
    // Única búsqueda permitida (100 unidades): solo si nadie más sabe su canal, y cacheada.
    const found = await cachedJson<{
      items?: { id?: { channelId?: string }; snippet?: { title?: string } }[];
    }>(
      'yt',
      `fav:yt:search:${a.slug}`,
      `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({ part: 'snippet', type: 'channel', q: a.name, maxResults: '3', key: youtubeKey })}`,
    );
    channelId =
      found?.items?.find((i) =>
        fold(i.snippet?.title ?? '')
          .replace(/[^a-z0-9]/g, '')
          .startsWith(fold(a.name).replace(/[^a-z0-9]/g, '')),
      )?.id?.channelId ?? null;
    if (channelId)
      console.log(`  canal encontrado con search.list: ${channelId}`);
  }
  if (!channelId) return null;
  const ch = await cachedJson<{
    items?: {
      snippet?: { title: string };
      statistics?: {
        viewCount?: string;
        subscriberCount?: string;
        videoCount?: string;
      };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }[];
  }>(
    'yt',
    `fav:yt:channel:${channelId}`,
    `https://www.googleapis.com/youtube/v3/channels?${new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: channelId, key: youtubeKey })}`,
  );
  const c = ch?.items?.[0];
  if (!c) return null;
  const uploads =
    c.contentDetails?.relatedPlaylists?.uploads ?? `UU${channelId.slice(2)}`;
  const ids: string[] = [];
  let token = '';
  for (let page = 0; page < 4; page++) {
    const body = await cachedJson<{
      nextPageToken?: string;
      items?: { contentDetails?: { videoId?: string } }[];
    }>(
      'yt',
      `fav:yt:uploads:${uploads}:${page}`,
      `https://www.googleapis.com/youtube/v3/playlistItems?${new URLSearchParams({ part: 'contentDetails', playlistId: uploads, maxResults: '50', key: youtubeKey, ...(token ? { pageToken: token } : {}) })}`,
    );
    ids.push(
      ...(body?.items ?? []).flatMap((i) => i.contentDetails?.videoId ?? []),
    );
    if (!body?.nextPageToken) break;
    token = body.nextPageToken;
  }
  const videos: {
    id: string;
    title: string;
    views: number;
    publishedAt: string;
    durationSec: number;
  }[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const body = await cachedJson<{
      items?: {
        id: string;
        snippet?: { title: string; publishedAt: string };
        statistics?: { viewCount?: string };
        contentDetails?: { duration?: string };
      }[];
    }>(
      'yt',
      `fav:yt:videos:${batch[0]}:${batch.length}`,
      `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: batch.join(','), key: youtubeKey })}`,
    );
    for (const v of body?.items ?? [])
      videos.push({
        id: v.id,
        title: v.snippet?.title ?? '',
        views: Number(v.statistics?.viewCount) || 0,
        publishedAt: v.snippet?.publishedAt ?? '',
        durationSec: isoSeconds(v.contentDetails?.duration ?? ''),
      });
  }
  videos.sort((x, y) => y.views - x.views);
  return {
    info: {
      channelId,
      title: c.snippet?.title ?? a.name,
      subscribers: Number(c.statistics?.subscriberCount) || null,
      views: Number(c.statistics?.viewCount) || null,
      videos: Number(c.statistics?.videoCount) || null,
      topVideos: videos
        .slice(0, TOP_VIDEOS)
        .map(({ durationSec: _d, ...v }) => v),
    },
    videos,
  };
}

const isoSeconds = (iso: string) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso);
  return m
    ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
    : 0;
};

/** Une discografías de MusicBrainz y Deezer sin repetir títulos (gana la fecha más completa). */
function mergeReleases(...lists: ProfileRelease[][]): ProfileRelease[] {
  const byTitle = new Map<string, ProfileRelease>();
  for (const r of lists.flat()) {
    const k = songKey(r.title);
    const old = byTitle.get(k);
    if (!old || (r.date?.length ?? 0) > (old.date?.length ?? 0))
      byTitle.set(k, { ...r, type: old?.type ?? r.type });
  }
  return [...byTitle.values()].sort((x, y) =>
    (y.date ?? '').localeCompare(x.date ?? ''),
  );
}

type Fav = PerreoProfile & {
  realName?: string | null;
  birthDate?: string | null;
  aliases?: string[];
  collaborators?: string[];
  channelId?: string | null;
};
const saved = readJson<{ order: string[]; profiles: Record<string, Fav> }>(
  'favorites.json',
  { order: [], profiles: {} },
);
const profiles: Record<string, Fav> = { ...saved.profiles };
const groupMembers: Record<string, string[]> = {};
const songs: PerreoSongFile[] = readJson<PerreoSongFile[]>(
  'fav-songs.json',
  [],
).filter((s) => !favorites.some((f) => f.slug === s.artistSlug));
const analysed = new Map(
  [
    ...readJson<PerreoSongFile[]>('songs.json', []),
    ...readJson<PerreoSongFile[]>('ig-songs.json', []),
    ...readJson<PerreoSongFile[]>('fav-songs.json', []),
  ]
    .filter((s) => s.attributes)
    .map((s) => [s.videoId, s]),
);

try {
  await migrate(db, {
    migrationsFolder: resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../drizzle',
    ),
  });
  for (const a of favorites) {
    console.log(`\n#${ranks.get(a.slug)} ${a.name}`);
    const sources: string[] = [];
    const mb = await musicbrainz(a);
    const qid =
      mb?.relations
        ?.map(
          (r) => /wikidata\.org\/wiki\/(Q\d+)/.exec(r.url?.resource ?? '')?.[1],
        )
        .find(Boolean) ?? null;
    if (mb) sources.push('musicbrainz');
    const wd = qid ? await wikidata(qid) : null;
    if (wd) sources.push('wikidata');
    const lfm = await lastfm(a.name);
    if (lfm) sources.push('lastfm');
    const dz = await deezer(a.name);
    if (dz) sources.push('deezer');
    const yt = await youtube(a, wd?.channelId ?? null);
    if (yt) sources.push('youtube');
    const discography = mergeReleases(
      mb ? await mbDiscography(mb.id) : [],
      dz?.releases ?? [],
    );

    // Grupo ↔ miembros: MusicBrainz («member of band», hacia atrás = sus miembros) y Wikidata P527.
    const mbMembers = (mb?.relations ?? [])
      .filter(
        (r) =>
          r.type === 'member of band' && r.direction === 'backward' && r.artist,
      )
      .map((r) => r.artist!.name);
    if (mbMembers.length || wd?.members.length)
      groupMembers[a.slug] = [
        ...new Set([...mbMembers, ...(wd?.members ?? [])]),
      ];

    profiles[a.slug] = {
      updatedAt: new Date().toISOString().slice(0, 10),
      sources,
      wikidata: qid,
      mbid: mb?.id ?? null,
      birthPlace: wd?.birthPlace ?? null,
      origin: wd?.origin ?? null,
      activeFrom: wd?.activeFrom ?? null,
      activeTo: wd?.activeTo ?? null,
      awards: wd?.awards ?? [],
      labels: wd?.labels ?? [],
      socials: {
        ...(wd?.socials ?? {}),
        ...(dz ? { deezer: dz.link } : {}),
        ...(yt
          ? { youtube: `https://www.youtube.com/channel/${yt.info.channelId}` }
          : {}),
      },
      discography,
      ...(lfm
        ? {
            lastfm: {
              listeners: lfm.listeners,
              playcount: lfm.playcount,
              tags: lfm.tags,
              similar: lfm.similar,
            },
          }
        : {}),
      ...(dz
        ? {
            deezer: {
              id: dz.id,
              fans: dz.fans,
              albums: dz.albums,
              link: dz.link,
              topTracks: dz.topTracks.slice(0, 15),
            },
          }
        : {}),
      ...(yt ? { youtube: yt.info } : {}),
      // Para rellenar huecos de la ficha (applyProfile).
      birthDate: wd?.birthDate ?? null,
      aliases: wd?.aliases ?? [],
      collaborators: dz?.collaborators ?? [],
      channelId: yt?.info.channelId ?? wd?.channelId ?? null,
    };
    console.log(
      `  fuentes: ${sources.join(', ') || 'ninguna'} · discos/sencillos: ${discography.length} · premios: ${wd?.awards.length ?? 0} · vídeos vistos: ${yt?.videos.length ?? 0}`,
    );

    // Varias canciones: los vídeos más vistos que parecen un tema, subidos de puesto si están en lo más escuchado.
    if (!args.includes('--no-songs') && yt) {
      const rank = new Map(
        [...(lfm?.topTracks ?? []), ...(dz?.topTracks ?? [])].map((t, i) => [
          songKey(t),
          i,
        ]),
      );
      const found = new Map<string, PerreoSongFile>();
      const maxViews = yt.videos[0]?.views || 1;
      for (const v of yt.videos) {
        if (v.durationSec && (v.durationSec < 90 || v.durationSec > 600))
          continue;
        const title = cleanTitle(v.title, a.name);
        if (!title || found.has(songKey(title))) continue;
        const r = rank.get(songKey(title));
        const popularity = Math.min(
          1,
          0.55 +
            0.35 * Math.sqrt(v.views / maxViews) +
            (r != null ? 0.1 * (1 - r / 100) : 0),
        );
        found.set(songKey(title), {
          videoId: v.id,
          title,
          artistSlug: a.slug,
          artistName: a.name,
          popularity,
          durationSec: v.durationSec || undefined,
          ...(analysed.get(v.id) ? pick(analysed.get(v.id)!) : {}),
        });
        if (found.size >= SONGS_PER_FAVORITE) break;
      }
      songs.push(...found.values());
      console.log(`  canciones: ${found.size}`);
    }
    writeJson('favorites.json', { order: [...ranks.keys()], profiles });
  }

  const links = linkGroups(groupMembers, artists);
  for (const [slug, l] of Object.entries(links)) {
    profiles[slug] = { ...(profiles[slug] ?? {}), ...l };
    console.log(
      `Grupo: ${slug} ${l.members ? `→ miembros ${l.members.join(', ')}` : `→ miembro de ${l.memberOf!.join(', ')}`}`,
    );
  }
  writeJson('favorites.json', { order: [...ranks.keys()], profiles });

  // Análisis de las canciones nuevas (Groq), por lotes; si se agota el cupo, se guarda lo hecho.
  const groq = config.groqApiKey
    ? new GroqTextProvider(createGroqClient(config.groqApiKey), [
        ...new Set([
          config.groqTextModel,
          ...config.groqFallbackModels,
          config.groqModel,
        ]),
      ])
    : null;
  const pending = songs.filter((s) => !s.attributes);
  if (groq && pending.length) {
    for (let i = 0; i < pending.length; i += ENRICH_BATCH) {
      const batch = pending.slice(i, i + ENRICH_BATCH);
      try {
        const result = await enrichSongs(
          groq,
          batch.map((s, k) => ({
            id: `s${k + 1}`,
            title: s.title,
            artist: s.artistName,
            hints: null,
          })),
        );
        batch.forEach((s, k) => {
          const e = result.get(`s${k + 1}`);
          if (e)
            Object.assign(s, {
              attributes: e.attributes,
              tags: e.tags,
              language: e.language,
            });
        });
      } catch (error) {
        console.warn(
          `Canciones sin analizar (${(error as Error).message.slice(0, 100)}): repite pnpm perreo:favorites (lo hecho está en caché).`,
        );
        break;
      }
      writeJson('fav-songs.json', songs);
      console.log(
        `  analizadas ${Math.min(i + ENRICH_BATCH, pending.length)}/${pending.length}`,
      );
    }
  }
  writeJson('fav-songs.json', songs);
  if (exhausted.size)
    console.warn(
      `Fuentes agotadas en esta ejecución: ${[...exhausted].join(', ')}.`,
    );
  console.log(
    `\nListo: favorites.json (${Object.keys(profiles).length} fichas) y fav-songs.json (${songs.length} canciones, ${songs.filter((s) => !s.attributes).length} sin analizar). Después: pnpm perreo:load [--prod].`,
  );
} finally {
  await client.end();
}

function pick(s: PerreoSongFile) {
  return {
    attributes: s.attributes,
    tags: s.tags,
    language: s.language,
    durationSec: s.durationSec,
  };
}
