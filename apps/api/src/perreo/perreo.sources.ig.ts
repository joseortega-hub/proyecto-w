// Fuentes de la ampliación con Instagram: MusicBrainz, Last.fm (búsqueda), ficha de Wikidata, Wikipedia y Commons.
// Mismas reglas que perreo.sources.ts: User-Agent propio, ritmo de cada API (MusicBrainz 1 petición/s) y vacío si falla.
import { fold } from './perreo.filters.js';
import { getJson, sleep, USER_AGENT } from './perreo.sources.js';

export interface MbArtist {
  mbid: string;
  name: string;
  qid: string | null;
  tags: string[];
  /** Usuarios de Instagram que MusicBrainz enlaza a este artista (en minúsculas). */
  instagram: string[];
}

interface MbArtistBody {
  id: string;
  name: string;
  tags?: { name: string; count: number }[];
  relations?: { url?: { resource: string } }[];
}

const MB = 'https://musicbrainz.org/ws/2';

function mbArtist(body: MbArtistBody): MbArtist {
  const urls = (body.relations ?? []).map((r) => r.url?.resource ?? '');
  return {
    mbid: body.id,
    name: body.name,
    qid: urls.map((u) => /wikidata\.org\/wiki\/(Q\d+)/.exec(u)?.[1]).find(Boolean) ?? null,
    tags: [...(body.tags ?? [])].sort((a, b) => b.count - a.count).map((t) => t.name),
    instagram: urls.flatMap((u) => /instagram\.com\/([\w.]+)/.exec(u)?.[1]?.toLowerCase() ?? []),
  };
}

const mbFull = (id: string) => getJson<MbArtistBody>(`${MB}/artist/${id}?inc=tags+url-rels&fmt=json`, 1100);

/** MusicBrainz: el artista cuya relación `url` es exactamente este Instagram (1 petición/s). */
export async function musicbrainzByInstagram(user: string): Promise<MbArtist | null> {
  const url = await getJson<{ relations?: { artist?: { id: string } }[] }>(
    `${MB}/url?${new URLSearchParams({ resource: `https://www.instagram.com/${user}/`, inc: 'artist-rels', fmt: 'json' })}`,
    1100,
  );
  const id = url?.relations?.find((r) => r.artist)?.artist?.id;
  const body = id ? await mbFull(id) : null;
  return body ? mbArtist(body) : null;
}

/** MusicBrainz por nombre: solo resultados de nombre exacto, con su ficha (etiquetas y enlaces). */
export async function musicbrainzByName(name: string, limit = 2): Promise<MbArtist[]> {
  const found = await getJson<{ artists?: { id: string; name: string; score: number }[] }>(
    `${MB}/artist?${new URLSearchParams({ query: `artist:"${name.replace(/"/g, '')}"`, limit: String(limit), fmt: 'json' })}`,
    1100,
  );
  const out: MbArtist[] = [];
  for (const hit of (found?.artists ?? []).filter((a) => a.score >= 90 && fold(a.name) === fold(name))) {
    const body = await mbFull(hit.id);
    if (body) out.push(mbArtist(body));
  }
  return out;
}

export interface LastfmCandidate {
  name: string;
  listeners: number;
  mbid: string | null;
  tags: string[];
}

/** Last.fm `artist.search` + `artist.getInfo` de los mejores resultados: nombre, oyentes y géneros. */
export async function lastfmSearch(query: string, apiKey: string, limit = 3): Promise<LastfmCandidate[]> {
  const call = <T>(method: string, extra: Record<string, string>) =>
    getJson<T>(`https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method, api_key: apiKey, format: 'json', ...extra })}`, 250);
  const found = await call<{ results?: { artistmatches?: { artist?: { name: string; mbid?: string }[] } } }>('artist.search', { artist: query, limit: String(limit) });
  const out: LastfmCandidate[] = [];
  for (const hit of found?.results?.artistmatches?.artist ?? []) {
    const info = await call<{ artist?: { stats?: { listeners?: string }; tags?: { tag?: { name: string }[] } } }>('artist.getinfo', { artist: hit.name });
    out.push({
      name: hit.name,
      mbid: hit.mbid || null,
      listeners: Number(info?.artist?.stats?.listeners) || 0,
      tags: (info?.artist?.tags?.tag ?? []).map((t) => t.name),
    });
  }
  return out;
}

export interface WikidataCard {
  qid: string;
  image: string | null;
  countries: string[];
  city: string | null;
  genres: string[];
  labels: string[];
  debutYear: number | null;
  birthDate: string | null;
  channelId: string | null;
  spotifyId: string | null;
  instagram: string | null;
  wikiTitle: { es: string | null; en: string | null };
}

type Snak = { mainsnak?: { datavalue?: { value?: unknown } } };
type Entities = { entities?: Record<string, { claims?: Record<string, Snak[]>; labels?: Record<string, { value: string }>; sitelinks?: Record<string, { title: string }> }> };

/** Los nombres de país como los usa el resto del Modo Perreo («Estados Unidos de América» → «Estados Unidos»). */
export const countryName = (c: string) => (/^estados unidos/i.test(c) ? 'Estados Unidos' : c);

/** Ficha en Wikidata: P18 foto, P27 país, P19/P740 ciudad, P136 géneros, P264 sellos, P2031 debut, P2397 canal, P1902 Spotify. */
export async function wikidataCard(qid: string): Promise<WikidataCard | null> {
  const api = (params: Record<string, string>) =>
    getJson<Entities>(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', format: 'json', ...params })}`, 1100);
  const entity = (await api({ ids: qid, props: 'claims|sitelinks' }))?.entities?.[qid];
  if (!entity) return null;
  const claims = entity.claims ?? {};
  const values = (p: string) => (claims[p] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter((v) => v != null);
  const ids = (p: string) => values(p).flatMap((v) => (typeof v === 'object' && v && 'id' in v ? [String((v as { id: string }).id)] : []));
  const str = (p: string) => values(p).find((v): v is string => typeof v === 'string') ?? null;
  const time = (p: string) => {
    const v = values(p).find((x) => typeof x === 'object' && x && 'time' in x) as { time: string } | undefined;
    return v ? v.time.replace(/^\+/, '') : null;
  };
  const wanted = [...new Set(['P27', 'P19', 'P740', 'P136', 'P264'].flatMap(ids))].slice(0, 50);
  const labelBody = wanted.length ? await api({ ids: wanted.join('|'), props: 'labels', languages: 'es|en' }) : null;
  const label = (id: string) => labelBody?.entities?.[id]?.labels?.es?.value ?? labelBody?.entities?.[id]?.labels?.en?.value ?? null;
  const names = (p: string) => [...new Set(ids(p).flatMap((id) => label(id) ?? []))];
  const start = time('P2031') ?? time('P571');
  return {
    qid,
    image: str('P18'),
    countries: names('P27').map(countryName),
    city: names('P19')[0] ?? names('P740')[0] ?? null,
    genres: names('P136'),
    labels: names('P264'),
    debutYear: start ? Number(start.slice(0, 4)) || null : null,
    birthDate: time('P569')?.slice(0, 10) ?? null,
    channelId: str('P2397'),
    spotifyId: str('P1902'),
    instagram: str('P2003'),
    wikiTitle: { es: entity.sitelinks?.eswiki?.title ?? null, en: entity.sitelinks?.enwiki?.title ?? null },
  };
}

/** Resumen de Wikipedia del título que enlaza Wikidata: primero en español y, si no hay, en inglés. */
export async function wikiSummaryByTitle(titles: { es: string | null; en: string | null }): Promise<{ extract: string; lang: 'es' | 'en' } | null> {
  for (const lang of ['es', 'en'] as const) {
    const title = titles[lang];
    if (!title) continue;
    const s = await getJson<{ extract?: string; type?: string }>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (s?.extract && s.type !== 'disambiguation') return { extract: s.extract, lang };
  }
  return null;
}

/** Foto de Wikimedia Commons por nombre de archivo (P18), de 600 px de ancho. */
export async function commonsPhoto(file: string): Promise<Buffer | null> {
  await sleep(500);
  const res = await fetch(`https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=600`, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' }).catch(() => null);
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
}
