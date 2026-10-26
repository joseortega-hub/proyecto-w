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
