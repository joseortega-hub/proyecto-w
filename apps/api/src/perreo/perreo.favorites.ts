// Favoritos del Modo Perreo: la lista ordenada de data/privado/perreo/favoritos.json (nombres o slugs, el primero
// es el más importante). Los scripts los procesan primero y `pnpm perreo:favorites` les hace una ficha completa.
// Aquí solo lógica pura (sin red ni BD) para poder probarla.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fold } from './perreo.filters.js';
import type { PerreoArtistFile, PerreoProfile } from './perreo.types.js';

/** «Wisin y Yandel», «Wisin & Yandel» y «wisin-yandel» se comparan igual. */
export const favKey = (s: string) =>
  fold(s)
    .replace(/&|\band\b/g, ' y ')
    .replace(/[^a-z0-9]/g, '');

/** Lee favoritos.json (array de nombres o slugs). Sin fichero, no hay favoritos. */
export function readFavorites(dir: string): string[] {
  const file = join(dir, 'favoritos.json');
  if (!existsSync(file)) return [];
  try {
    const list = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    return Array.isArray(list)
      ? list.filter((x): x is string => typeof x === 'string' && !!x.trim())
      : [];
  } catch {
    return [];
  }
}

/** Slug → puesto (1, 2, 3…) según el orden de la lista. Lo que no se encuentra se ignora. */
export function favoriteRanks(
  names: string[],
  artists: { slug: string; name: string; aliases?: string[] }[],
): Map<string, number> {
  const ranks = new Map<string, number>();
  for (const name of names) {
    const key = favKey(name);
    const hit =
      artists.find((a) => a.slug === name.trim()) ??
      artists.find((a) => favKey(a.name) === key) ??
      artists.find((a) => favKey(a.slug) === key) ??
      artists.find((a) => (a.aliases ?? []).some((x) => favKey(x) === key));
    if (hit && !ranks.has(hit.slug)) ranks.set(hit.slug, ranks.size + 1);
  }
  return ranks;
}

/** Favoritos primero (en su orden) y el resto como estaba (orden estable). */
export function favoritesFirst<T>(
  list: T[],
  slugOf: (x: T) => string,
  ranks: Map<string, number>,
): T[] {
  const rank = (x: T) => ranks.get(slugOf(x)) ?? Infinity;
  return list
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rank(a.x) - rank(b.x) || a.i - b.i)
    .map(({ x }) => x);
}

const empty = (v: unknown) =>
  v == null || v === '' || (Array.isArray(v) && !v.length);

/**
 * Completa la ficha con lo que trae la ficha ampliada, sin cambiar lo que ya hay: solo rellena huecos
 * (nombre real, nacimiento, ciudad, debut, sellos, alias, colaboradores, canal) y suma redes que falten.
 * Lo editado a mano lo protege después `protectManual` en `perreo:load`.
 */
export function applyProfile(
  a: PerreoArtistFile,
  p: PerreoProfile & {
    realName?: string | null;
    birthDate?: string | null;
    aliases?: string[];
    collaborators?: string[];
    channelId?: string | null;
  },
): PerreoArtistFile {
  const out: PerreoArtistFile = { ...a, links: { ...a.links }, profile: p };
  if (empty(out.realName) && p.realName) out.realName = p.realName;
  if (empty(out.birthDate) && p.birthDate) out.birthDate = p.birthDate;
  if (empty(out.city) && (p.birthPlace || p.origin))
    out.city = p.origin ?? p.birthPlace ?? null;
  if (empty(out.debutYear) && p.activeFrom) out.debutYear = p.activeFrom;
  if (empty(out.activeUntil) && p.activeTo) out.activeUntil = p.activeTo;
  if (empty(out.labels) && p.labels?.length)
    out.labels = p.labels.map((name) => ({ name, start: null, end: null }));
  if (empty(out.aliases) && p.aliases?.length) out.aliases = p.aliases;
  if (empty(out.collaborators) && p.collaborators?.length)
    out.collaborators = p.collaborators;
  if (empty(out.youtubeChannelId) && p.channelId)
    out.youtubeChannelId = p.channelId;
  for (const [k, v] of Object.entries(p.socials ?? {}))
    if (!out.links[k]) out.links[k] = v;
  return out;
}

/**
 * Enlaza grupos y miembros dentro del Modo Perreo. `groups` = slug del grupo → nombres de sus miembros
 * (de MusicBrainz o Wikidata). Devuelve, por slug, `members` (en el grupo) y `memberOf` (en cada miembro).
 */
export function linkGroups(
  groups: Record<string, string[]>,
  artists: { slug: string; name: string }[],
): Record<string, { members?: string[]; memberOf?: string[] }> {
  const bySlugKey = new Map(artists.map((a) => [favKey(a.name), a.slug]));
  const out: Record<string, { members?: string[]; memberOf?: string[] }> = {};
  for (const [group, names] of Object.entries(groups)) {
    const members = [
      ...new Set(names.flatMap((n) => bySlugKey.get(favKey(n)) ?? [])),
    ].filter((s) => s !== group);
    if (!members.length) continue;
    out[group] = { ...out[group], members };
    for (const m of members)
      out[m] = {
        ...out[m],
        memberOf: [...new Set([...(out[m]?.memberOf ?? []), group])],
      };
  }
  return out;
}
