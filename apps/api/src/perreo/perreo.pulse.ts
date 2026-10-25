// «El pulso» del Modo Perreo, sin red: rangos de fechas de novedades, ranking de lo más caliente
// por país y momento, y cifras normalizadas para el cara a cara. Los datos los precalcula `pnpm perreo:pulse`.
import { fold } from './perreo.filters.js';

export type Period = 'week' | 'month' | 'year';
export type ReleasePeriod = Period | 'upcoming';
export const PERIODS: readonly Period[] = ['week', 'month', 'year'];
export const RELEASE_PERIODS: readonly ReleasePeriod[] = ['week', 'month', 'year', 'upcoming'];

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/**
 * Rango [from, to] (AAAA-MM-DD, ambos incluidos) de cada momento. Semana y mes son los últimos 7 y 30 días
 * (un lunes, «esta semana» de calendario saldría vacía: los lanzamientos son los viernes); el año, desde el 1 de enero;
 * «próximamente», de mañana a un año vista.
 */
export function periodRange(period: ReleasePeriod, now = new Date()): { from: string; to: string } {
  const today = day(now);
  if (period === 'upcoming') return { from: day(addDays(now, 1)), to: day(addDays(now, 365)) };
  if (period === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: day(addDays(now, period === 'week' ? -6 : -29)), to: today };
}

/** MusicBrainz da a veces solo el año o el mes («2026», «2026-11»): se toma el primer día. */
export const padDate = (d: string) => (/^\d{4}$/.test(d) ? `${d}-01-01` : /^\d{4}-\d{2}$/.test(d) ? `${d}-01` : d.slice(0, 10));

export function inPeriod(date: string, period: ReleasePeriod, now = new Date()): boolean {
  if (!/^\d{4}/.test(date)) return false;
  const { from, to } = periodRange(period, now);
  // Solo el año: «2027» es próximo; uno del año en curso es ambiguo y no se da por futuro.
  if (period === 'upcoming' && /^\d{4}$/.test(date)) return date > day(now).slice(0, 4) && date <= to.slice(0, 4);
  const d = padDate(date);
  return d >= from && d <= to;
}

export interface Release {
  id: string;
  artistSlug: string;
  /** 'album' (discos y EP) o 'song' (sencillos). */
  kind: 'album' | 'song';
  recordType: string | null;
  title: string;
  releaseDate: string;
  coverUrl: string | null;
  link: string | null;
  source: string;
  fans: number | null;
}

const titleKey = (t: string) =>
  fold(t)
    .replace(/\(.*?\)|\[.*?\]|feat\..*$|ft\..*$/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** El mismo lanzamiento en Deezer y en MusicBrainz cuenta una vez (gana el que trae portada). */
export function dedupeReleases(rows: Release[]): Release[] {
  const best = new Map<string, Release>();
  for (const r of rows) {
    const key = `${r.artistSlug}|${r.kind}|${titleKey(r.title)}`;
    const cur = best.get(key);
    if (!cur || (!cur.coverUrl && r.coverUrl)) best.set(key, cur && !r.coverUrl ? cur : r);
  }
  return [...best.values()];
}

/** Novedades de un momento: lo reciente, lo último primero; lo próximo, lo más cercano primero. */
export function filterReleases(rows: Release[], period: ReleasePeriod, kind?: 'album' | 'song', now = new Date()): Release[] {
  const out = dedupeReleases(rows).filter((r) => (!kind || r.kind === kind) && inPeriod(r.releaseDate, period, now));
  return out.sort((a, b) => (period === 'upcoming' ? padDate(a.releaseDate).localeCompare(padDate(b.releaseDate)) : padDate(b.releaseDate).localeCompare(padDate(a.releaseDate))) || (b.fans ?? 0) - (a.fans ?? 0));
}

// ------------------------------------ Lo más caliente ------------------------------------

export interface StatSnapshot {
  day: string;
  lastfmListeners: number | null;
  lastfmPlays: number | null;
  deezerFans: number | null;
  youtubeViews: number | null;
  /** Puesto en el top de Last.fm de cada país (nombre en español). */
  geo: Record<string, number>;
}

export interface HotInput {
  slug: string;
  countries: string[];
  fame: number;
  /** Fotos del pulso, de la más antigua a la más reciente. */
  stats: StatSnapshot[];
  releases: Pick<Release, 'kind' | 'releaseDate'>[];
}

export interface HotEntry {
  slug: string;
  score: number;
  reasons: string[];
  /** Crecimiento de oyentes, fans y visitas en el periodo (0,05 = +5 %), si hay fotos para compararlo. */
  growth: number | null;
  releases: number;
  geoRank: number | null;
}

/** Crecimiento medio entre dos fotos (oyentes, fans y visitas que tengan ambas). */
export function growthBetween(a: StatSnapshot, b: StatSnapshot): number | null {
  const pairs = (['lastfmListeners', 'deezerFans', 'youtubeViews'] as const).map((k) => [a[k], b[k]] as const).filter(([x, y]) => x && y);
  if (!pairs.length) return null;
  return pairs.reduce((s, [x, y]) => s + (y! - x!) / x!, 0) / pairs.length;
}

const percentiles = (values: (number | null)[]) => {
  const sorted = values.filter((v): v is number => v != null).sort((a, b) => a - b);
  return values.map((v) => (v == null || sorted.length < 2 ? null : (sorted.filter((x) => x < v).length / (sorted.length - 1)) * 100));
};

/**
 * Ranking de lo más caliente de un momento y, si se pide, de un país: son de ese país o están en su top de Last.fm.
 * Mezcla, con pesos fijos y a la vista: lanzamientos del periodo (35 %, un disco vale doble que un sencillo),
 * crecimiento de oyentes, fans y visitas (35 %, solo si hay fotos de antes) y popularidad de fondo (30 %);
 * estar en el top del país suma hasta 25 puntos. Sin crecimiento medible, su peso pasa a los lanzamientos y la popularidad.
 */
export function rankHot(list: HotInput[], opts: { period: Period; country?: string; now?: Date; limit?: number }): HotEntry[] {
  const now = opts.now ?? new Date();
  const { from } = periodRange(opts.period, now);
  const country = opts.country ? fold(opts.country) : '';
  const latest = (a: HotInput) => a.stats[a.stats.length - 1];
  const scoped = list.filter((a) => !country || a.countries.some((c) => fold(c) === country) || Object.keys(latest(a)?.geo ?? {}).some((c) => fold(c) === country));
  const rows = scoped.map((a) => {
    const last = latest(a);
    // La foto de referencia es la última anterior al inicio del periodo (o la primera, si todas son de dentro).
    const before = [...a.stats].reverse().find((s) => s.day <= from) ?? (a.stats.length > 1 ? a.stats[0] : undefined);
    const growth = last && before && before !== last ? growthBetween(before, last) : null;
    const rel = a.releases.filter((r) => inPeriod(r.releaseDate, opts.period, now));
    const relPoints = rel.reduce((s, r) => s + (r.kind === 'album' ? 2 : 1), 0);
    const geoRank = country && last ? (Object.entries(last.geo).find(([c]) => fold(c) === country)?.[1] ?? null) : null;
    return { a, growth, rel: rel.length, relPoints, geoRank };
  });
  const growthPct = percentiles(rows.map((r) => r.growth));
  const anyGrowth = growthPct.some((g) => g != null);
  const out = rows.map((r, i) => {
    const relScore = Math.min(r.relPoints, 4) * 25;
    const parts = anyGrowth ? 0.35 * relScore + 0.35 * (growthPct[i] ?? 0) + 0.3 * r.a.fame : 0.5 * relScore + 0.5 * r.a.fame;
    const geoBonus = r.geoRank ? Math.max(0, 25 - (r.geoRank - 1) * 0.5) : 0;
    const reasons: string[] = [];
    if (r.rel) reasons.push(r.rel === 1 ? '1 lanzamiento' : `${r.rel} lanzamientos`);
    if (r.growth != null && Math.abs(r.growth) >= 0.005) reasons.push(`${r.growth > 0 ? '+' : ''}${(r.growth * 100).toFixed(r.growth < 0.1 ? 1 : 0)} % de público`);
    if (r.geoRank) reasons.push(`Nº ${r.geoRank} en ${opts.country} (Last.fm)`);
    if (!reasons.length) reasons.push(r.a.fame >= 80 ? 'Siempre arriba' : 'Por su fama');
    return { slug: r.a.slug, score: Math.round((parts + geoBonus) * 10) / 10, reasons, growth: r.growth, releases: r.rel, geoRank: r.geoRank };
  });
  return out.sort((x, y) => y.score - x.score || x.slug.localeCompare(y.slug)).slice(0, opts.limit ?? 30);
}

// ------------------------------------ Cara a cara ------------------------------------

export const COMPARE_METRICS = [
  { id: 'youtubeViews', label: 'Visitas en YouTube', source: 'YouTube' },
  { id: 'lastfmListeners', label: 'Oyentes en Last.fm', source: 'Last.fm' },
  { id: 'lastfmPlays', label: 'Reproducciones en Last.fm', source: 'Last.fm' },
  { id: 'deezerFans', label: 'Fans en Deezer', source: 'Deezer' },
  { id: 'releasesYear', label: 'Lanzamientos este año', source: 'Deezer y MusicBrainz' },
  { id: 'fame', label: 'Popularidad', source: 'Sintonía' },
  { id: 'streetLevel', label: 'Nivel de calle', source: 'A mano' },
] as const;
export type CompareMetric = (typeof COMPARE_METRICS)[number]['id'];

export interface CompareRow {
  slug: string;
  values: Partial<Record<CompareMetric, number | null>>;
}

export interface CompareResult {
  metrics: { id: CompareMetric; label: string; source: string; max: number; winners: string[]; shares: Record<string, number | null> }[];
  /** Cuántas métricas gana cada uno (el marcador). */
  wins: Record<string, number>;
  /** El que más gana; null si hay empate arriba. */
  champion: string | null;
}

/**
 * Cifras listas para las barras del cara a cara: cada valor como fracción (0–1) del mayor de esa métrica,
 * quién gana cada una (los empates ganan todos) y el marcador. Las métricas sin datos de nadie no salen.
 */
export function normalizeCompare(rows: CompareRow[]): CompareResult {
  const wins = Object.fromEntries(rows.map((r) => [r.slug, 0]));
  const metrics = COMPARE_METRICS.flatMap((m) => {
    const vals = rows.map((r) => r.values[m.id] ?? null);
    const known = vals.filter((v): v is number => v != null);
    if (!known.length) return [];
    const max = Math.max(...known);
    const winners = max > 0 ? rows.filter((_, i) => vals[i] === max).map((r) => r.slug) : [];
    for (const w of winners) wins[w]++;
    const shares = Object.fromEntries(rows.map((r, i) => [r.slug, vals[i] == null ? null : max > 0 ? vals[i]! / max : 0]));
    return [{ id: m.id, label: m.label, source: m.source, max, winners, shares }];
  });
  const top = Math.max(0, ...Object.values(wins));
  const leaders = Object.keys(wins).filter((k) => wins[k] === top);
  return { metrics, wins, champion: top > 0 && leaders.length === 1 ? leaders[0] : null };
}

// ------------------------------------ Países ------------------------------------

/** Países del top de Last.fm (`geo.getTopArtists` pide el nombre en inglés). */
export const GEO_COUNTRIES: Record<string, string> = {
  España: 'Spain',
  México: 'Mexico',
  Colombia: 'Colombia',
  Argentina: 'Argentina',
  Chile: 'Chile',
  Perú: 'Peru',
  Venezuela: 'Venezuela',
  'República Dominicana': 'Dominican Republic',
  'Puerto Rico': 'Puerto Rico',
  'Estados Unidos': 'United States',
  Ecuador: 'Ecuador',
  Panamá: 'Panama',
  Cuba: 'Cuba',
  Uruguay: 'Uruguay',
  Paraguay: 'Paraguay',
  Bolivia: 'Bolivia',
  Guatemala: 'Guatemala',
  'Costa Rica': 'Costa Rica',
};
