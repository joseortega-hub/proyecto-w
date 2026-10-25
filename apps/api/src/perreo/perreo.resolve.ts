// Lógica pura de la ampliación con Instagram: cuándo una coincidencia es segura, cuándo hay que revisarla
// a mano y cómo se detectan los artistas que ya están entre los 66.
import { createHash } from 'node:crypto';
import { fold } from './perreo.filters.js';
import { fameFromListeners } from './perreo.sources.js';
import type { PerreoArtistFile, PerreoOverlay } from './perreo.types.js';

/** Sufijos típicos de un usuario de artista («wisinoficial», «jbalvinmusic»). */
const SUFFIXES = ['oficial', 'official', 'music', 'musica', 'ofc', 'tv', 'rd', 'pr', 'real', 'mx', 'col'];
const URBAN = /reggaeton|reguet|urban|latin|trap|dembow|hip.?hop|rap|perreo|salsa|bachata|corrido|cumbia|spanish|pop latino|r&b|mambo|champeta/i;

/** Solo letras y números, sin tildes: «J. Balvin» → «jbalvin». */
export const squash = (s: string) => fold(s).replace(/[^a-z0-9]/g, '');

/** Versión legible del usuario sin sufijos de oficialidad: «wisin.oficial» → «wisin». */
export function baseName(username: string): string {
  let base = squash(username);
  for (const s of SUFFIXES) if (base.length > s.length + 3 && base.endsWith(s)) base = base.slice(0, -s.length);
  return base;
}

/** Texto para buscar: «el.alfa_oficial» → «el alfa». */
export const searchName = (username: string) =>
  username
    .toLowerCase()
    .replace(/[._]+/g, ' ')
    .replace(/\b(oficial|official|music|musica|ofc|tv)\b/g, '')
    .replace(/\d+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

export const isUrban = (tags: string[]) => tags.slice(0, 8).some((t) => URBAN.test(t));

/** El nombre del artista es el usuario (o el usuario sin «oficial»…) quitando signos y tildes. */
export const sameName = (username: string, artistName: string) => {
  const name = squash(artistName);
  return name.length >= 3 && (name === squash(username) || name === baseName(username));
};

export interface Candidate {
  name: string;
  listeners: number;
  tags: string[];
  /** MusicBrainz enlaza exactamente este Instagram a este artista. */
  linkMatch?: boolean;
}

export type Verdict = { kind: 'sure' | 'review'; reason: string } | null;

export const MIN_SURE_LISTENERS = 3000;
export const MIN_REVIEW_LISTENERS = 1000;

/**
 * Criterios de la segunda pasada. Segura: el enlace de Instagram coincide, o el nombre es exacto, el género
 * es urbano o latino y tiene un mínimo de oyentes. Por revisar: nombre exacto sin género claro o con pocos
 * oyentes, o nombre parecido con género urbano y muchos oyentes. Todo lo demás se descarta.
 */
export function classify(username: string, c: Candidate): Verdict {
  if (c.linkMatch) return { kind: 'sure', reason: 'MusicBrainz enlaza este Instagram' };
  const urban = isUrban(c.tags);
  if (sameName(username, c.name)) {
    if (urban && c.listeners >= MIN_SURE_LISTENERS) return { kind: 'sure', reason: 'nombre exacto y género urbano' };
    if (c.listeners >= MIN_REVIEW_LISTENERS) return { kind: 'review', reason: urban ? 'nombre exacto pero pocos oyentes' : 'nombre exacto pero género no urbano' };
    return null;
  }
  const a = baseName(username);
  const b = squash(c.name);
  const near = a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a)) && Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.7;
  return near && urban && c.listeners >= 5000 ? { kind: 'review', reason: 'nombre parecido y género urbano' } : null;
}

/** Hash corto de un usuario: así se recuerda qué cuentas ya se miraron sin guardar las que no son artistas. */
export const accountHash = (username: string) => createHash('sha256').update(`sintonia:${username.toLowerCase()}`).digest('hex').slice(0, 16);

export interface Known {
  slug: string;
  name: string;
  qid?: string | null;
  mbid?: string | null;
}

/** ¿Ya está entre los conocidos? Empareja por Wikidata, MBID o nombre normalizado. */
export function findDuplicate(candidate: { name: string; qid?: string | null; mbid?: string | null }, known: Known[]): Known | undefined {
  const name = squash(candidate.name);
  return known.find((k) => (candidate.qid && k.qid === candidate.qid) || (candidate.mbid && k.mbid === candidate.mbid) || (name && squash(k.name) === name));
}

/** Slug libre a partir de un nombre: «Álvaro Díaz» → «alvaro-diaz» (con -2, -3… si ya existe). */
export function freeSlug(name: string, taken: Set<string>): string {
  const base = fold(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'artista';
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/** Los 66 + los de Instagram: marca los que sigues, suma sus parecidos y calcula la fama sobre todos (mismo percentil de oyentes). */
export function mergePerreo(base: PerreoArtistFile[], ig: PerreoArtistFile[], overlay: Record<string, PerreoOverlay>): PerreoArtistFile[] {
  const all = [
    ...base.map((a) => {
      const o = overlay[a.slug];
      return { ...a, source: 'urbanopedia' as const, followed: !!o, links: o && !a.links.instagram ? { ...a.links, instagram: o.instagram } : a.links, similar: [...new Set([...a.similar, ...(o?.similar ?? [])])].slice(0, 12) };
    }),
    ...ig.filter((a) => !base.some((b) => b.slug === a.slug)).map((a) => ({ ...a, source: 'instagram' as const, followed: true })),
  ];
  fameFromListeners(all.map((a) => a.listeners)).forEach((f, i) => (all[i].fame = f));
  return all;
}

/** Estilos del Modo Perreo a partir de géneros y etiquetas (Wikidata, Last.fm): el respaldo sin IA. */
export function stylesFromTags(tags: string[]): string[] {
  const text = tags.map((t) => fold(t)).join(' | ');
  const out: string[] = [];
  if (/trap/.test(text)) out.push('trap');
  if (/dembow|dominican/.test(text)) out.push('dembow');
  if (/romantic|balada|bolero|pop latin|latin pop|baladas/.test(text)) out.push('romántico');
  if (/reggaeton|reguet|perreo|urbano/.test(text) || (!out.length && /urban|latin/.test(text) && !/latin pop/.test(text))) out.push('perreo');
  if (!out.length && /hip.?hop|rap/.test(text)) out.push('trap');
  return [...new Set(out)];
}
