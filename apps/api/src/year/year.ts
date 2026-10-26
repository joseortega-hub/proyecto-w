// «Tu año en Sintonía»: el resumen tipo Wrapped sale solo de datos guardados (lógica pura).
// La IA, como mucho, reescribe los titulares; las cifras y los nombres salen de aquí.
import type { SeenRating } from '../taste/taste.engine.js';

export interface YearSession {
  domainId: string;
  createdAt: Date;
  anchors: string[];
  initialText: string | null;
  scales: Record<string, number> | null;
  recommended: number;
}

export interface YearItem {
  domainId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  durationSec: number | null;
  /** «Ya visto» con su nota; los 👍 cuentan como `liked`. */
  rating: SeenRating | null;
  seen: boolean;
}

export interface YearDomain {
  id: string;
  name: string;
  itemNounPlural: string;
  attributes: { key: string; label: string; kind: string; lowLabel?: string; highLabel?: string }[];
}

export interface YearSummary {
  year: number;
  empty: boolean;
  totals: { sessions: number; recommended: number; seen: number; rated: number; domains: number };
  domains: { id: string; name: string; sessions: number; seen: number }[];
  topRated: { domainId: string; title: string; subtitle: string | null; imageUrl: string | null; rating: SeenRating }[];
  creators: { domainId: string; name: string; count: number }[];
  words: { word: string; count: number }[];
  vibe: { domainId: string; name: string; sessions: number; bars: { key: string; label: string; value: number; word: string | null }[] } | null;
  facts: string[];
}

const RATING_SCORE: Record<SeenRating, number> = { loved: 2, liked: 1, meh: 0 };
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Palabras que no dicen nada en un texto libre («quiero algo para esta noche»). */
const STOPWORDS = new Set(
  'algo algun alguna algunos como con cosa cosas cuando desde donde esta este esto estos estoy hacer hasta hoy mucho muy nada para pero poco porque quiero quisiera sobre solo tengo todo tipo una unas unos peli pelis pelicula peliculas libro libros juego juegos cancion canciones musica tenga sean ser tiene that with para algo'.split(' '),
);
const TIME_ZONE = 'Europe/Madrid';
/** Para «Tus 12 películas vistas suman 25 horas» (libros y juegos no tienen duración real). */
const PARTICIPLES: Record<string, string> = { movies: 'vistas', music: 'escuchadas' };

const top = <T>(map: Map<string, T & { count: number }>, n: number) => [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Partes de la fecha en la hora de España (la API corre en UTC). */
function local(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short', hour: 'numeric', hourCycle: 'h23', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')),
    hour: Number(get('hour')),
    day: `${get('year')}-${get('month').padStart(2, '0')}-${get('day').padStart(2, '0')}`,
    date: { d: Number(get('day')), m: Number(get('month')) - 1 },
  };
}

/** Racha más larga de días seguidos con alguna entrevista. */
export function longestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    const t = Date.parse(`${d}T00:00:00Z`) / 86_400_000;
    run = prev !== null && t - prev === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

/** Las palabras más pedidas: lo concreto que pidió (anclas) y, si hay pocas, las de sus textos. */
export function topWords(sessions: Pick<YearSession, 'anchors' | 'initialText'>[], n = 8) {
  const counts = new Map<string, { word: string; count: number }>();
  const add = (word: string) => {
    const k = strip(word);
    const prev = counts.get(k);
    counts.set(k, { word: prev?.word ?? word, count: (prev?.count ?? 0) + 1 });
  };
  for (const s of sessions) for (const a of new Set(s.anchors)) add(a);
  if (counts.size < 3) {
    for (const s of sessions) {
      const words = (s.initialText ?? '').toLowerCase().match(/\p{L}{4,}/gu) ?? [];
      for (const w of new Set(words)) if (!STOPWORDS.has(strip(w))) add(w);
    }
  }
  return top(counts, n);
}

/** Resumen del año con lo guardado: sesiones, «ya visto», 👍, anclas y ánimo de cada entrevista. */
export function buildYear(year: number, sessions: YearSession[], items: YearItem[], domains: YearDomain[]): YearSummary {
  const byId = new Map(domains.map((d) => [d.id, d]));
  const perDomain = new Map<string, { id: string; name: string; sessions: number; seen: number; count: number }>();
  const domainRow = (id: string) => {
    const row = perDomain.get(id) ?? { id, name: byId.get(id)?.name ?? id, sessions: 0, seen: 0, count: 0 };
    perDomain.set(id, row);
    return row;
  };
  for (const s of sessions) domainRow(s.domainId).sessions++;
  for (const it of items) if (it.seen) domainRow(it.domainId).seen++;
  for (const row of perDomain.values()) row.count = row.sessions * 2 + row.seen;
  const domainList = top(perDomain, 6).map(({ count: _c, ...d }) => d);

  const rated = items.filter((it) => it.rating && it.rating !== 'meh');
  const topRated = [...rated]
    .sort((a, b) => RATING_SCORE[b.rating!] - RATING_SCORE[a.rating!] || Number(b.seen) - Number(a.seen))
    .filter((it, i, all) => all.findIndex((x) => x.title === it.title && x.domainId === it.domainId) === i)
    .slice(0, 5)
    .map((it) => ({ domainId: it.domainId, title: it.title, subtitle: it.subtitle, imageUrl: it.imageUrl, rating: it.rating! }));

  // Directores, autores, estudios o artistas: el subtítulo de lo que vio o le gustó (lo «meh» no suma).
  const creators = new Map<string, { domainId: string; name: string; count: number }>();
  for (const it of items) {
    if (!it.subtitle || it.rating === 'meh') continue;
    const key = `${it.domainId}|${strip(it.subtitle)}`;
    const prev = creators.get(key);
    creators.set(key, { domainId: it.domainId, name: prev?.name ?? it.subtitle, count: (prev?.count ?? 0) + 1 });
  }
  const creatorList = top(creators, 5).filter((c) => c.count >= 2);

  // «Tu vibra» media: la de la temática con más entrevistas que tengan perfil de ánimo.
  const withScales = sessions.filter((s) => s.scales && Object.keys(s.scales).length);
  const vibeDomain = domainList.find((d) => withScales.some((s) => s.domainId === d.id));
  let vibe: YearSummary['vibe'] = null;
  if (vibeDomain) {
    const own = withScales.filter((s) => s.domainId === vibeDomain.id);
    const attrs = (byId.get(vibeDomain.id)?.attributes ?? []).filter((a) => a.kind === 'scale');
    const bars = attrs
      .map((a) => {
        const values = own.map((s) => s.scales![a.key]).filter((v): v is number => Number.isFinite(v));
        if (!values.length) return null;
        const value = Math.round((values.reduce((x, y) => x + y, 0) / values.length) * 100) / 100;
        const word = value >= 0.62 ? (a.highLabel ?? null) : value <= 0.38 ? (a.lowLabel ?? null) : null;
        return { key: a.key, label: a.label, value, word };
      })
      .filter((b) => b !== null)
      .slice(0, 5);
    if (bars.length) vibe = { domainId: vibeDomain.id, name: vibeDomain.name, sessions: own.length, bars };
  }

  const facts: string[] = [];
  if (sessions.length >= 3) {
    const when = sessions.map((s) => local(s.createdAt));
    const weekdays = new Array(7).fill(0);
    const slots = { mañana: 0, tarde: 0, noche: 0 };
    for (const w of when) {
      weekdays[w.weekday]++;
      slots[w.hour >= 6 && w.hour < 14 ? 'mañana' : w.hour >= 14 && w.hour < 21 ? 'tarde' : 'noche']++;
    }
    const day = weekdays.indexOf(Math.max(...weekdays));
    facts.push(`Tu día con más entrevistas es el ${WEEKDAYS[day]}`);
    const slot = (Object.entries(slots) as [string, number][]).sort((a, b) => b[1] - a[1])[0][0];
    facts.push(`Sueles pedir recomendaciones por la ${slot}`);
    const streak = longestStreak(when.map((w) => w.day));
    if (streak >= 2) facts.push(`Tu mejor racha: ${streak} días seguidos`);
  }
  for (const d of domainList) {
    const timed = items.filter((it) => it.seen && it.domainId === d.id && it.durationSec);
    const hours = Math.round(timed.reduce((sum, it) => sum + it.durationSec!, 0) / 3600);
    const participle = PARTICIPLES[d.id];
    if (hours >= 2 && participle) facts.push(`Tus ${timed.length} ${byId.get(d.id)?.itemNounPlural ?? ''} ${participle} suman ${hours} horas`);
  }
  const first = [...sessions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  if (first) {
    const { date } = local(first.createdAt);
    facts.push(`Tu primera entrevista del año fue el ${date.d} de ${MONTHS[date.m]}`);
  }
  const recommended = sessions.reduce((sum, s) => sum + s.recommended, 0);

  return {
    year,
    empty: !sessions.length && !items.length,
    totals: {
      sessions: sessions.length,
      recommended,
      seen: items.filter((it) => it.seen).length,
      rated: rated.length,
      domains: domainList.length,
    },
    domains: domainList,
    topRated,
    creators: creatorList,
    words: topWords(sessions),
    vibe,
    facts: facts.slice(0, 4),
  };
}

export type YearCardKind = 'intro' | 'domains' | 'rated' | 'creators' | 'words' | 'vibe' | 'facts';

/** Tarjetas con datos, en orden. Sin datos para una tarjeta, no sale. */
export function yearCards(s: YearSummary): YearCardKind[] {
  if (s.empty) return [];
  const cards: YearCardKind[] = ['intro'];
  if (s.domains.length) cards.push('domains');
  if (s.topRated.length) cards.push('rated');
  if (s.creators.length) cards.push('creators');
  if (s.words.length) cards.push('words');
  if (s.vibe) cards.push('vibe');
  if (s.facts.length) cards.push('facts');
  return cards;
}

/** Titulares por plantilla: siempre ciertos. La IA puede reescribirlos con las mismas cifras. */
export function templateHeadlines(s: YearSummary): Record<YearCardKind, string> {
  const fav = s.domains[0];
  const love = s.topRated[0];
  const creator = s.creators[0];
  return {
    intro: `${s.totals.sessions} ${s.totals.sessions === 1 ? 'entrevista' : 'entrevistas'} y ${s.totals.recommended} recomendaciones`,
    domains: fav ? `Lo tuyo es ${fav.name.toLowerCase()}` : 'Tus temáticas',
    rated: love ? `Lo que más te ha gustado: ${love.title}` : 'Lo que más te ha gustado',
    creators: creator ? `${creator.name} se repite en tu año` : 'Tus nombres del año',
    words: s.words[0] ? `Lo que más pides: ${s.words[0].word}` : 'Lo que más pides',
    vibe: s.vibe ? `Tu vibra media en ${s.vibe.name.toLowerCase()}` : 'Tu vibra media',
    facts: 'Datos curiosos de tu año',
  };
}

/**
 * Un titular de la IA vale solo si es corto y no trae cifras que no estén en los datos: así no
 * se inventa nada (si falla, se queda la plantilla).
 */
export function validHeadline(text: unknown, s: YearSummary): text is string {
  if (typeof text !== 'string' || !text.trim() || text.length > 70) return false;
  const known = new Set(JSON.stringify(s).match(/\d+/g) ?? []);
  return (text.match(/\d+/g) ?? []).every((n) => known.has(n));
}
