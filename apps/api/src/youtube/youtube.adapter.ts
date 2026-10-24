import type { CatalogAdapter, ImportedItem } from '../catalog/catalog-adapter.js';
import { YouTubeApiError, type YouTubeApi } from './youtube.client.js';
import type { YouTubeVideo } from './youtube.types.js';

/** Categoría "Música" de YouTube: lo demás (vlogs, tutoriales…) no entra en el catálogo. */
export const MUSIC_CATEGORY = '10';
/** Más de 15 minutos suele ser un mix o un disco entero, no una canción. */
const MAX_SONG_SEC = 15 * 60;
const PAGE = 50;
/** Límites de lectura para no gastar cuota de más (todas son lecturas de 1 unidad por página). */
const MAX_LIKED_PAGES = 20;
const MAX_PLAYLISTS = 40;
const MAX_PLAYLIST_PAGES = 4;

interface Page<T> {
  items?: T[];
  nextPageToken?: string;
}
interface VideoResource {
  id: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
    thumbnails?: Record<string, { url: string; width?: number }>;
  };
  contentDetails?: { duration?: string };
}
interface PlaylistResource {
  id: string;
  snippet?: { title?: string };
  contentDetails?: { itemCount?: number };
}
interface PlaylistItemResource {
  contentDetails?: { videoId?: string };
}

/** Duración ISO 8601 de YouTube ("PT3M27S") a segundos. */
export function parseIsoDuration(value: string | undefined): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value ?? '');
  if (!m) return null;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86_400 + h * 3600 + min * 60 + s;
}

/** Restos de los títulos de YouTube que no forman parte del nombre de la canción. */
const NOISE =
  /official|oficial|video|vídeo|videoclip|clip|audio|lyrics?|letra|visuali[sz]er|music video|mv|hd|hq|4k|explicit|explícito|en vivo|live session/i;

/** "Bad Bunny - Topic" → "Bad Bunny"; "BadBunnyVEVO" → "BadBunny"; quita "Official", "Music"… */
export function cleanChannel(channel: string): string {
  return channel
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/\s*-\s*Tema$/i, '')
    .replace(/VEVO$/i, '')
    .replace(/\s*(official|oficial)(\s+(channel|canal))?\s*$/i, '')
    .replace(/^(.+?)\s+(music|records|tv)$/i, '$1')
    .trim();
}

/**
 * Limpia el título de un vídeo y separa artista y canción:
 * "Bad Bunny - DtMF (Official Video)" → { artist: "Bad Bunny", title: "DtMF" }.
 * En los canales "Artista - Topic" (los de YouTube Music) el título ya es la canción.
 */
export function cleanTitle(rawTitle: string, channel: string): { title: string; artist: string } {
  const topic = /-\s*(Topic|Tema)$/i.test(channel);
  let title = rawTitle
    // Paréntesis o corchetes con "Official Video", "Letra", "4K"…; se conservan "feat." y "Remix".
    .replace(/[([{]([^)\]}]*)[)\]}]/g, (whole, inner: string) => (NOISE.test(inner) && !/feat|ft\.|remix|prod/i.test(inner) ? '' : whole))
    // Todo lo que va detrás de " | " o " // " (canal, sello, "Video Oficial").
    .replace(/\s+(\||\/\/)\s+.*$/, '')
    .replace(/#\S+/g, '')
    .replace(/\b(official|oficial)\s+(music\s+)?(video|vídeo|audio)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  let artist = cleanChannel(channel);
  if (!topic) {
    const parts = title.split(/\s+[-–—]\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }
  }
  title = title.replace(/^["“'‘]+|["”'’]+$/g, '').replace(/[\s\-–—|:]+$/, '').trim();
  return { title: title || rawTitle.trim(), artist: artist || channel.trim() };
}

/** La mejor miniatura disponible (las de YouTube Music son cuadradas en `maxres`/`high`). */
function thumbnail(snippet: VideoResource['snippet']): string | null {
  const t = snippet?.thumbnails ?? {};
  return (t.high ?? t.medium ?? t.standard ?? t.maxres ?? t.default)?.url ?? null;
}

export function toVideo(resource: VideoResource, from: string): YouTubeVideo {
  const s = resource.snippet ?? {};
  return {
    id: resource.id,
    title: s.title ?? '',
    channelTitle: s.channelTitle ?? '',
    description: (s.description ?? '').slice(0, 300),
    tags: (s.tags ?? []).slice(0, 12),
    categoryId: s.categoryId ?? '',
    durationSec: parseIsoDuration(resource.contentDetails?.duration),
    thumbnail: thumbnail(s),
    from: [from],
  };
}

/** Solo canciones: categoría Música y duración razonable. Fuera vídeos privados o borrados. */
export const isSong = (v: YouTubeVideo) =>
  v.categoryId === MUSIC_CATEGORY && !!v.title && v.title !== 'Private video' && (v.durationSec ?? 0) <= MAX_SONG_SEC;

/** Vídeo → elemento del catálogo, aún sin atributos (los deduce la IA después). */
export function toImportedItem(video: YouTubeVideo): ImportedItem {
  const { title, artist } = cleanTitle(video.title, video.channelTitle);
  return {
    source: 'youtube',
    externalId: video.id,
    title,
    subtitle: artist,
    description: null,
    imageUrl: video.thumbnail,
    mediaUrl: `https://www.youtube.com/watch?v=${video.id}`,
    externalUrl: `https://music.youtube.com/watch?v=${video.id}`,
    durationSec: video.durationSec,
    attributes: {},
    tags: [],
    facets: {},
    // Lo que sale en varias listas (o en "Me gusta" y en una lista) es lo que más le gusta.
    popularity: Math.min(1, video.from.length / 3),
    classifyHints: [video.tags.join(', '), video.description.slice(0, 160)].filter(Boolean).join(' · '),
  };
}

/**
 * Importa la música de la cuenta de YouTube de una persona: sus vídeos con "Me gusta"
 * (`videos.list?myRating=like`) y los de sus listas (`playlists.list?mine=true` +
 * `playlistItems.list`), y se queda con los de la categoría Música (10). Nunca usa
 * `search.list` (100 unidades): todo son lecturas de 1 unidad por página.
 */
export class YouTubeAdapter implements CatalogAdapter {
  readonly domainId = 'youtube';
  readonly source = 'youtube';
  /** Si la lista "LM" (Me gusta de YouTube Music) es accesible con la API oficial. */
  likedMusicPlaylist: 'ok' | 'unavailable' = 'unavailable';

  constructor(private readonly api: YouTubeApi) {}

  async fetchItems({ limit, onProgress }: { limit: number; onProgress?: (message: string) => void }): Promise<ImportedItem[]> {
    const videos = await this.fetchVideos(limit, onProgress);
    return videos.map(toImportedItem);
  }

  async fetchVideos(limit: number, onProgress: (message: string) => void = () => undefined): Promise<YouTubeVideo[]> {
    const found = new Map<string, YouTubeVideo>();
    const add = (video: YouTubeVideo) => {
      const known = found.get(video.id);
      if (known) known.from = [...new Set([...known.from, ...video.from])];
      else found.set(video.id, video);
    };

    // 1. "Me gusta": videos.list ya trae la categoría, así que no hace falta otra llamada.
    onProgress('Leyendo tus "Me gusta"');
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_LIKED_PAGES && found.size < limit; page++) {
      const res = await this.api.get<Page<VideoResource>>('videos', {
        part: 'snippet,contentDetails',
        myRating: 'like',
        maxResults: PAGE,
        pageToken,
      });
      for (const r of res.items ?? []) {
        const video = toVideo(r, 'Me gusta');
        if (isSong(video)) add(video);
      }
      pageToken = res.nextPageToken;
      if (!pageToken) break;
    }

    // 2. Listas: la "LM" de YouTube Music (si la API la deja leer) y las propias.
    const pending = new Map<string, string[]>();
    const queue = (videoId: string, from: string) => {
      if (found.has(videoId)) found.get(videoId)!.from.push(from);
      else pending.set(videoId, [...(pending.get(videoId) ?? []), from]);
    };
    const lm = await this.playlistVideoIds('LM').catch((error: Error) => {
      if (error instanceof YouTubeApiError) return null;
      throw error;
    });
    this.likedMusicPlaylist = lm ? 'ok' : 'unavailable';
    for (const id of lm ?? []) queue(id, 'Me gusta de YouTube Music');

    onProgress('Leyendo tus listas');
    const playlists: PlaylistResource[] = [];
    pageToken = undefined;
    for (let page = 0; page < 2 && playlists.length < MAX_PLAYLISTS; page++) {
      const res: Page<PlaylistResource> = await this.api.get<Page<PlaylistResource>>('playlists', { part: 'snippet,contentDetails', mine: true, maxResults: PAGE, pageToken });
      playlists.push(...(res.items ?? []));
      pageToken = res.nextPageToken;
      if (!pageToken) break;
    }
    for (const [i, playlist] of playlists.slice(0, MAX_PLAYLISTS).entries()) {
      if (found.size + pending.size >= limit * 1.5) break;
      if (!playlist.contentDetails?.itemCount) continue;
      const name = playlist.snippet?.title ?? 'Lista';
      onProgress(`Leyendo tus listas (${i + 1}/${Math.min(playlists.length, MAX_PLAYLISTS)}): ${name}`);
      const ids = await this.playlistVideoIds(playlist.id).catch((error: Error) => {
        if (error instanceof YouTubeApiError) return [];
        throw error;
      });
      for (const id of ids) queue(id, name);
    }

    // 3. Los vídeos de las listas, de 50 en 50, para saber su categoría y duración.
    const ids = [...pending.keys()];
    for (let i = 0; i < ids.length && found.size < limit; i += PAGE) {
      onProgress(`Comprobando qué es música (${Math.min(i + PAGE, ids.length)}/${ids.length})`);
      const res = await this.api.get<Page<VideoResource>>('videos', {
        part: 'snippet,contentDetails',
        id: ids.slice(i, i + PAGE).join(','),
        maxResults: PAGE,
      });
      for (const r of res.items ?? []) {
        const video = toVideo(r, '');
        video.from = pending.get(r.id) ?? [];
        if (isSong(video)) add(video);
      }
    }
    return [...found.values()].slice(0, limit);
  }

  private async playlistVideoIds(playlistId: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PLAYLIST_PAGES; page++) {
      const res = await this.api.get<Page<PlaylistItemResource>>('playlistItems', {
        part: 'contentDetails',
        playlistId,
        maxResults: PAGE,
        pageToken,
      });
      ids.push(...(res.items ?? []).flatMap((it) => (it.contentDetails?.videoId ? [it.contentDetails.videoId] : [])));
      pageToken = res.nextPageToken;
      if (!pageToken) break;
    }
    return ids;
  }
}
