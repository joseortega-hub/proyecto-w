// Fuentes del importador del Modo Perreo: Wikipedia, Wikidata, Last.fm y el canal de YouTube de cada artista.
// Todo lo que viene de fuera se trata como dato; cada fuente que falla devuelve vacío y el resto sigue.
import { fold } from './perreo.filters.js';

export interface WikiBio {
  title: string;
  extract: string;
  qid: string | null;
}

export const USER_AGENT = 'Sintonia/0.1 (https://github.com/joseortega-hub/proyecto-w; easter egg educativo)';
const MUSIC_WORDS = /cantante|rapero|raper|reguet|músic|musico|compositor|trap|urban|productor|dj\b/i;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getJson<T>(url: string, minGap = 400): Promise<T | null> {
  await sleep(minGap);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }).catch(() => null);
    if (res?.ok) return (await res.json()) as T;
    if (res && res.status !== 429 && res.status < 500) return null;
    await sleep(1500 * attempt);
  }
  return null;
}

/** Biografía de Wikipedia en español: la página con el nombre exacto o, si no, un resultado de música cuyo título coincide. */
export async function wikiBio(name: string): Promise<WikiBio | null> {
  type Summary = { extract?: string; type?: string; title: string; wikibase_item?: string };
  const summaryOf = (key: string) => getJson<Summary>(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`);
  const accept = (s: Summary | null, strict: boolean): WikiBio | null => {
    if (!s?.extract || s.type === 'disambiguation' || !MUSIC_WORDS.test(s.extract)) return null;
    const title = fold(s.title.replace(/\s*\([^)]*\)/, ''));
    const wanted = fold(name);
    // «Wisin» no puede aceptar «Wisin & Yandel»: el título debe ser el nombre (o contenerlo sin añadir otro artista).
    const same = title === wanted || (!strict && (title.startsWith(wanted) || wanted.startsWith(title)) && !/ & | y /.test(title));
    return same ? { title: s.title, extract: s.extract, qid: s.wikibase_item ?? null } : null;
  };
  const direct = accept(await summaryOf(name.replace(/ /g, '_')), false) ?? accept(await summaryOf(`${name} (cantante)`.replace(/ /g, '_')), false);
  if (direct) return direct;
  const search = await getJson<{ pages?: { key: string }[] }>(
    `https://es.wikipedia.org/w/rest.php/v1/search/page?${new URLSearchParams({ q: `${name} cantante reguetón`, limit: '4' })}`,
  );
  for (const page of search?.pages ?? []) {
    const found = accept(await summaryOf(page.key), true);
    if (found) return found;
  }
  return null;
}

export interface WikidataFacts {
  channelId: string | null;
  instagram: string | null;
}

/** Canal de YouTube (P2397) y usuario de Instagram (P2003) de una entidad de Wikidata. */
export async function wikidataFacts(qid: string): Promise<WikidataFacts> {
  const body = await getJson<{ entities?: Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }> }>(
    `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: qid, props: 'claims', format: 'json' })}`,
    1100,
  );
  const claims = body?.entities?.[qid]?.claims ?? {};
  const first = (p: string) => {
    const v = claims[p]?.[0]?.mainsnak?.datavalue?.value;
    return typeof v === 'string' ? v : null;
  };
  return { channelId: first('P2397'), instagram: first('P2003') };
}

export interface LastfmArtist {
  listeners: number | null;
  similar: string[];
  topTracks: string[];
}

/** Oyentes, artistas parecidos y canciones más escuchadas de Last.fm. */
export async function lastfmArtist(name: string, apiKey: string): Promise<LastfmArtist> {
  const call = <T>(method: string, extra: Record<string, string> = {}) =>
    getJson<T>(`https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method, artist: name, autocorrect: '1', api_key: apiKey, format: 'json', ...extra })}`, 250);
  const [info, similar, top] = await Promise.all([
    call<{ artist?: { stats?: { listeners?: string } } }>('artist.getinfo'),
    call<{ similarartists?: { artist?: { name: string }[] } }>('artist.getsimilar', { limit: '60' }),
    call<{ toptracks?: { track?: { name: string }[] } }>('artist.gettoptracks', { limit: '30' }),
  ]);
  const listeners = Number(info?.artist?.stats?.listeners);
  return {
    listeners: Number.isFinite(listeners) ? listeners : null,
    similar: (similar?.similarartists?.artist ?? []).map((a) => a.name),
    topTracks: (top?.toptracks?.track ?? []).map((t) => t.name),
  };
}

export interface ChannelVideo {
  id: string;
  title: string;
  publishedAt: string;
}

/** Los últimos vídeos de un canal por su RSS público (sin clave ni cuota; 15 como mucho). */
export async function channelFeed(channelId: string): Promise<ChannelVideo[]> {
  await sleep(300);
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`, { headers: { 'User-Agent': USER_AGENT } }).catch(() => null);
  return res?.ok ? parseFeed(await res.text()) : [];
}

/** Subidas del canal con la YouTube Data API (`playlistItems`, 1 unidad por página de 50). Solo con clave. */
export async function channelUploads(channelId: string, apiKey: string, pages = 1): Promise<ChannelVideo[]> {
  if (!/^UC[\w-]{20,}$/.test(channelId)) return [];
  const playlistId = `UU${channelId.slice(2)}`;
  const out: ChannelVideo[] = [];
  let pageToken = '';
  for (let i = 0; i < pages; i++) {
    const body = await getJson<{ nextPageToken?: string; items?: { snippet?: { title: string; publishedAt: string; resourceId?: { videoId?: string } } }[] }>(
      `https://www.googleapis.com/youtube/v3/playlistItems?${new URLSearchParams({ part: 'snippet', playlistId, maxResults: '50', key: apiKey, ...(pageToken ? { pageToken } : {}) })}`,
      200,
    );
    for (const it of body?.items ?? []) {
      const id = it.snippet?.resourceId?.videoId;
      if (id && it.snippet) out.push({ id, title: it.snippet.title, publishedAt: it.snippet.publishedAt });
    }
    if (!body?.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return out;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

/** Lee el Atom de YouTube: `<entry>` con `yt:videoId`, `title` y `published`. */
export function parseFeed(xml: string): ChannelVideo[] {
  const entries = xml.split('<entry>').slice(1);
  return entries.flatMap((e) => {
    const id = /<yt:videoId>([^<]+)</.exec(e)?.[1];
    const title = /<title>([^<]*)</.exec(e)?.[1];
    const publishedAt = /<published>([^<]+)</.exec(e)?.[1] ?? '';
    return id && title ? [{ id, title: decode(title), publishedAt }] : [];
  });
}

/** Palabras de relleno de los títulos de YouTube («Video Oficial», «Lyric Video»…). */
const NOISE = /\b(video\s*oficial|official\s*(music\s*)?video|official\s*audio|audio\s*oficial|lyric\s*video|letra|visualizer|video\s*lyrics?|lyrics?|\bhd\b|4k)\b/i;

/** «Wisin - Mi Mejor Amigo (Video Oficial)» → «Mi Mejor Amigo». Devuelve null si no parece una canción. */
export function cleanTitle(raw: string, artist: string): string | null {
  let t = raw.replace(/\[[^\]]*\]/g, ' ').replace(/\(([^)]*)\)/g, (m, inner: string) => (NOISE.test(inner) ? ' ' : m));
  t = t.replace(NOISE, ' ');
  const parts = t.split(/\s[-–—|]\s/).map((p) => p.trim()).filter(Boolean);
  const artistKey = fold(artist);
  const kept = parts.filter((p) => !(fold(p) === artistKey || fold(p).startsWith(`${artistKey} `) && parts.length > 1 && p.length < artist.length + 3));
  t = (kept.length ? kept : parts).join(' - ').replace(/\s+/g, ' ').replace(/[-–—|]\s*$/, '').trim();
  // Entrevistas, conciertos completos, mezclas y compilaciones no son canciones.
  if (t.length < 2 || t.length > 90 || /entrevista|concierto|en vivo completo|full\s*(album|concert)|mix\b|mashup|trailer|shorts?\b|behind the scenes/i.test(t)) return null;
  return t;
}

/** Quita lo que no cuenta al comparar títulos: tildes, paréntesis y signos. */
export const songKey = (title: string) =>
  fold(title)
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Fama 0–100 de cada artista: su percentil de oyentes entre todos (el más escuchado, 100).
 * Sin oyentes, 0. Con empates, el mismo valor.
 */
export function fameFromListeners(listeners: (number | null)[]): number[] {
  const known = listeners.filter((l): l is number => l != null && l > 0).sort((a, b) => a - b);
  return listeners.map((l) => {
    if (l == null || l <= 0 || known.length < 2) return 0;
    const below = known.filter((k) => k < l).length;
    return Math.round((below / (known.length - 1)) * 100);
  });
}

/** Nombres de Last.fm → slugs de los 66, sin repetir y sin el propio artista. */
export function matchSimilar(names: string[], bySlugName: Map<string, string>, self: string, limit = 8): string[] {
  const out: string[] = [];
  for (const n of names) {
    const slug = bySlugName.get(fold(n));
    if (slug && slug !== self && !out.includes(slug)) out.push(slug);
  }
  return out.slice(0, limit);
}
