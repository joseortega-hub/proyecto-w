/**
 * Enlaza las canciones de «Mi YouTube» de cada persona con los artistas del Modo Perreo.
 * Solo usa lo que guarda la importación: el artista ya limpio (`subtitle`, del título o del canal)
 * y el título, que conserva los «feat.». Sin llamadas externas.
 */

export interface ArtistKey {
  slug: string;
  name: string;
  aliases: string[];
}

export interface SongRef {
  title: string;
  subtitle: string | null;
}

/** Clave de comparación: sin tildes, sin mayúsculas, sin espacios ni signos ("Ñengo Flow" → "nengoflow"; "BadBunny" = "Bad Bunny"). */
export function artistKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\$/g, 's')
    .replace(/[^a-z0-9]+/g, '');
}

/** Separadores de colaboraciones: "A, B & C", "A x B", "A y B", "A feat. B", "A con B". */
const COLLAB = /\s*(?:,|;|&|\+|\/|\s(?:x|y|and|vs\.?|con|with|feat\.?|ft\.?|featuring)\s)\s*/i;
/** Lo que va tras "feat." o "ft." en el título: "Canción (feat. A & B)" o "Canción ft. A". */
const FEAT = /\b(?:feat\.?|ft\.?|featuring)\s+([^)\]]+)/gi;

/** Nombres de artista que aparecen en una canción: el artista completo, cada colaborador y los «feat.» del título. */
export function songArtistNames(song: SongRef): string[] {
  const names: string[] = [];
  const add = (raw: string) => {
    const name = raw.replace(/^[\s([]+|[\s)\]]+$/g, '').trim();
    if (!name) return;
    names.push(name);
    // Primero entero (grupos como "Wisin & Yandel"), luego cada parte.
    const parts = name.split(COLLAB).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) for (const p of parts) add(p);
  };
  if (song.subtitle) add(song.subtitle.replace(FEAT, (_m, rest: string) => `, ${rest}`));
  for (const m of song.title.matchAll(FEAT)) add(m[1]);
  return names;
}

/** Índice clave → slugs, con el nombre y los alias de cada artista. Claves de menos de 2 caracteres no cuentan. */
export function buildArtistIndex(artists: ArtistKey[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const a of artists) {
    for (const name of [a.name, ...a.aliases]) {
      const key = artistKey(name);
      if (key.length < 2) continue;
      const slugs = index.get(key) ?? [];
      if (!slugs.includes(a.slug)) slugs.push(a.slug);
      index.set(key, slugs);
    }
  }
  return index;
}

/** Artistas del Perreo de una canción, sin repetir y en el orden en que aparecen. */
export function matchSong(song: SongRef, index: Map<string, string[]>): string[] {
  const out: string[] = [];
  for (const name of songArtistNames(song)) {
    for (const slug of index.get(artistKey(name)) ?? []) if (!out.includes(slug)) out.push(slug);
  }
  return out;
}

/**
 * Canciones de cada artista. Una canción que sale en varias listas (o con el mismo vídeo dos veces)
 * cuenta una vez: se agrupa por `videoId`.
 */
export function linkSongs<T extends SongRef & { id: string; videoId: string }>(songs: T[], index: Map<string, string[]>) {
  const bySlug = new Map<string, T[]>();
  const bySong = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const song of songs) {
    if (seen.has(song.videoId)) continue;
    seen.add(song.videoId);
    const slugs = matchSong(song, index);
    if (!slugs.length) continue;
    bySong.set(song.id, slugs);
    for (const slug of slugs) bySlug.set(slug, [...(bySlug.get(slug) ?? []), song]);
  }
  return { bySlug, bySong };
}

/** 👍/👎 de la persona en «Mi YouTube» (`taste_profiles.feedback`, itemId → up | down). */
export type Likes = Record<string, 'up' | 'down'>;

/** Peso de una canción guardada: 1; con 👍, 3; con 👎, 0 (no cuenta). */
export const songWeight = (id: string, likes: Likes) => (likes[id] === 'down' ? 0 : likes[id] === 'up' ? 3 : 1);

/** Artistas por lo que pesan en tu YouTube (temas guardados y 👍), de más a menos. */
export function rankSaved<T extends { id: string }>(bySlug: Map<string, T[]>, likes: Likes) {
  return [...bySlug]
    .map(([slug, songs]) => ({
      slug,
      count: songs.length,
      likes: songs.filter((s) => likes[s.id] === 'up').length,
      score: songs.reduce((sum, s) => sum + songWeight(s.id, likes), 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || b.count - a.count);
}

/**
 * Artistas de tus canciones que aún no tienen ficha en el Perreo: cada colaborador por separado
 * (no "A x B" entero), agrupados por clave y con el nombre que más se repite. Los de más peso, primero.
 */
export function unmatchedArtists(songs: (SongRef & { id: string })[], index: Map<string, string[]>, likes: Likes = {}) {
  const found = new Map<string, { names: Map<string, number>; songs: number; score: number }>();
  for (const song of songs) {
    const keys = new Set<string>();
    for (const name of songArtistNames(song)) {
      const key = artistKey(name);
      if (key.length < 2 || index.has(key) || name.split(COLLAB).length > 1 || keys.has(key)) continue;
      keys.add(key);
      const entry = found.get(key) ?? { names: new Map(), songs: 0, score: 0 };
      entry.names.set(name, (entry.names.get(name) ?? 0) + 1);
      entry.songs++;
      entry.score += songWeight(song.id, likes);
      found.set(key, entry);
    }
  }
  return [...found]
    .filter(([, e]) => e.score > 0)
    .map(([key, e]) => ({ key, name: [...e.names].sort((a, b) => b[1] - a[1])[0][0], songs: e.songs, score: e.score }))
    .sort((a, b) => b.score - a.score || b.songs - a.songs);
}

interface SavedSong extends SongRef {
  id: string;
  externalId: string;
  durationSec: number | null;
  attributes: Record<string, number>;
  tags: string[];
  facets: Record<string, string | string[]>;
}

/**
 * Tus canciones de YouTube como canciones del Perreo (a nombre del primer artista que sale en ellas).
 * Las que el catálogo ya tiene (`known`, por vídeo) no se tocan; con 👎, fuera. Lo que tiene 👍 o
 * sale en varias listas sube un poco, sin pasar por delante de las más escuchadas de Last.fm.
 */
export function savedSongFiles(songs: SavedSong[], index: Map<string, string[]>, names: Map<string, string>, likes: Likes, known: Set<string>) {
  const out = new Map<string, { videoId: string; title: string; artistSlug: string; artistName: string; popularity: number; durationSec?: number; attributes?: Record<string, number>; tags?: string[]; language?: string }>();
  for (const s of songs) {
    if (known.has(s.externalId) || out.has(s.externalId) || likes[s.id] === 'down') continue;
    const slug = matchSong(s, index).find((x) => names.has(x));
    if (!slug) continue;
    const language = typeof s.facets.language === 'string' ? s.facets.language : undefined;
    out.set(s.externalId, {
      videoId: s.externalId,
      title: s.title,
      artistSlug: slug,
      artistName: names.get(slug)!,
      popularity: likes[s.id] === 'up' ? 0.5 : 0.35,
      ...(s.durationSec ? { durationSec: s.durationSec } : {}),
      // Sin atributos todavía (la IA no los dedujo): que los complete el análisis de siempre.
      ...(Object.keys(s.attributes).length ? { attributes: s.attributes, tags: s.tags } : {}),
      ...(language ? { language } : {}),
    });
  }
  return [...out.values()];
}
