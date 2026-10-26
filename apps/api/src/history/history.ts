// Importar historial (Letterboxd, Goodreads, Steam): lógica pura, sin red ni base de datos.
import type { SeenRating } from '../taste/taste.engine.js';

export type HistorySource = 'letterboxd' | 'goodreads' | 'steam';

/** Fuente de historial de cada temática. */
export const HISTORY_SOURCES: Record<string, HistorySource> = { movies: 'letterboxd', books: 'goodreads', games: 'steam' };

/** Tope de entradas por importación (una biblioteca enorme se importa en dos veces). */
export const MAX_ENTRIES = 5000;

/** Una línea del historial, ya limpia. Es lo único que se guarda mientras dura la importación. */
export interface HistoryEntry {
  title: string;
  year?: number;
  author?: string;
  rating: SeenRating | null;
}

/** CSV con comillas, comas y saltos de línea dentro de los campos (RFC 4180). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

/** Filas como objetos por nombre de columna (sin distinguir mayúsculas). */
function records(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const [head = [], ...body] = parseCsv(text);
  const headers = head.map((h) => h.trim().toLowerCase());
  return { headers, rows: body.map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

export class HistoryFormatError extends Error {}

/** Nota de Letterboxd (0,5–5 estrellas) → «me encantó / bien / meh». */
export function letterboxdRating(stars: number): SeenRating | null {
  if (!Number.isFinite(stars) || stars <= 0) return null;
  if (stars >= 4.5) return 'loved';
  if (stars >= 3) return 'liked';
  return 'meh';
}

/** Nota de Goodreads (1–5, 0 = sin nota) → «me encantó / bien / meh». */
export function goodreadsRating(stars: number): SeenRating | null {
  if (!Number.isFinite(stars) || stars <= 0) return null;
  if (stars >= 5) return 'loved';
  if (stars >= 3) return 'liked';
  return 'meh';
}

/** Steam no tiene notas: las horas jugadas hacen de pista (muchas horas = le encantó). */
export function steamRating(minutes: number): SeenRating | null {
  if (minutes >= 50 * 60) return 'loved';
  if (minutes >= 10 * 60) return 'liked';
  return null;
}

/** Menos de una hora no cuenta como jugado (juegos regalados, de prueba o que no arrancó). */
export const STEAM_MIN_MINUTES = 60;

/** `watched.csv`, `ratings.csv` o `diary.csv` de Letterboxd (Name, Year y, si la hay, Rating). */
export function parseLetterboxd(text: string): HistoryEntry[] {
  const { headers, rows } = records(text);
  if (!headers.includes('name') || !headers.includes('year') || !headers.includes('letterboxd uri')) {
    throw new HistoryFormatError('No parece un CSV de Letterboxd: faltan las columnas Name, Year y Letterboxd URI.');
  }
  return dedupe(
    rows
      .filter((r) => r.name)
      .map((r) => ({ title: r.name, year: Number(r.year) || undefined, rating: letterboxdRating(Number(r.rating)) })),
  );
}

/** Exportación de Goodreads: solo lo de la estantería «read» (o con nota). */
export function parseGoodreads(text: string): HistoryEntry[] {
  const { headers, rows } = records(text);
  if (!headers.includes('title') || !headers.includes('author') || !headers.includes('my rating')) {
    throw new HistoryFormatError('No parece la exportación de Goodreads: faltan las columnas Title, Author y My Rating.');
  }
  return dedupe(
    rows
      .filter((r) => r.title && (!headers.includes('exclusive shelf') || r['exclusive shelf'] === 'read' || Number(r['my rating']) > 0))
      .map((r) => ({
        title: r.title,
        author: r.author || undefined,
        year: Number(r['original publication year']) || Number(r['year published']) || undefined,
        rating: goodreadsRating(Number(r['my rating'])),
      })),
  );
}

/** Juegos de `GetOwnedGames` con al menos una hora. */
export function steamEntries(games: { appid: number; name?: string; playtime_forever?: number }[]): HistoryEntry[] {
  return dedupe(
    games
      .filter((g) => g.name && (g.playtime_forever ?? 0) >= STEAM_MIN_MINUTES)
      .sort((a, b) => (b.playtime_forever ?? 0) - (a.playtime_forever ?? 0))
      .map((g) => ({ title: g.name!, rating: steamRating(g.playtime_forever ?? 0) })),
  );
}

function dedupe(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Map<string, HistoryEntry>();
  for (const e of entries) {
    const key = `${normalizeTitle(e.title)}|${e.year ?? ''}`;
    const before = seen.get(key);
    seen.set(key, before ? { ...before, rating: e.rating ?? before.rating } : e);
  }
  return [...seen.values()].slice(0, MAX_ENTRIES);
}

/**
 * SteamID64 o nombre personalizado a partir de lo que pega la persona: el número, la URL
 * `steamcommunity.com/profiles/…` o `steamcommunity.com/id/…`, o el nombre a secas.
 */
export function parseSteamProfile(input: string): { steamId: string } | { vanity: string } | null {
  const value = input.trim();
  const profile = value.match(/steamcommunity\.com\/profiles\/(\d{17})/i) ?? value.match(/^(\d{17})$/);
  if (profile) return { steamId: profile[1] };
  const vanity = value.match(/steamcommunity\.com\/id\/([\w-]{2,32})/i) ?? value.match(/^([\w-]{2,32})$/);
  return vanity ? { vanity: vanity[1] } : null;
}

/** Título comparable: sin tildes, mayúsculas, signos, artículo inicial ni serie entre paréntesis. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s*\((?:[^)]*#\d+[^)]*|\d{4})\)\s*$/, '')
    .replace(/&/g, ' and ')
    .replace(/[™®©]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/^(the|a|an|el|la|los|las) /, '')
    .trim();
}

/** Sin subtítulo ("Dune: Messiah" → "dune"), para un segundo intento. */
const mainTitle = (title: string) => normalizeTitle(title.split(/[:–—]/)[0]);

export interface CatalogCandidate {
  id: string;
  title: string;
  subtitle: string | null;
  year?: number | null;
  /** Otros títulos del mismo elemento (el original, si el catálogo lo guarda en español). */
  alternates?: string[];
}

const surname = (name: string) => normalizeTitle(name).split(' ').filter(Boolean).at(-1) ?? '';

/**
 * Busca la entrada en el catálogo: mismo título normalizado (o el título sin subtítulo), con
 * el año a ±1 si los dos lo tienen y el apellido del autor si la entrada lo trae.
 */
export function matchEntry(entry: HistoryEntry, catalog: CatalogCandidate[]): string | null {
  const exact = normalizeTitle(entry.title);
  const short = mainTitle(entry.title);
  const author = entry.author ? surname(entry.author) : '';
  const fits = (c: CatalogCandidate) =>
    (!entry.year || !c.year || Math.abs(entry.year - c.year) <= 1) && (!author || normalizeTitle(c.subtitle ?? '').includes(author));
  const titles = (c: CatalogCandidate) => [c.title, ...(c.alternates ?? [])];
  const byExact = catalog.find((c) => fits(c) && titles(c).some((t) => normalizeTitle(t) === exact));
  if (byExact) return byExact.id;
  const byShort = short.length >= 4 ? catalog.find((c) => fits(c) && titles(c).some((t) => normalizeTitle(t) === short || mainTitle(t) === short)) : undefined;
  return byShort?.id ?? null;
}
