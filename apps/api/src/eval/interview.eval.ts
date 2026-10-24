/**
 * `pnpm eval`: batería de escenarios contra la API REAL (proveedores de IA reales, catálogo real).
 * Cada escenario recorre el camino de la web (entender → empezar → responder → Afinando → lista)
 * y comprueba el resultado con aserciones claras.
 *
 *   pnpm eval                      # contra la API local (http://localhost:3001)
 *   pnpm eval --prod               # contra producción (https://sintonia-api-7763.onrender.com)
 *   pnpm eval --base=http://localhost:3003 --only=marvel,alas
 *
 * Los temas personales ("Mi YouTube", "Mi carpeta") solo se prueban si se pasa el dueño de sus
 * elementos con `--youtube-user=<uuid>` / `--folder-user=<uuid>` (en local se detecta solo).
 */
import { config } from '../config.js';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || 'true'] as const;
  }),
);
const PROD = args.has('prod');
const BASE = (args.get('base') ?? (PROD ? 'https://sintonia-api-7763.onrender.com' : `http://localhost:${config.apiPort}`)).replace(/\/$/, '') + '/api';
const ONLY = args.get('only')?.split(',').filter(Boolean) ?? [];
/** Persona anónima fija de las evals: sus gustos se guardan y se borran en cada escenario. */
const EVAL_USER = '6d637000-5e17-4a1a-8000-0000000e7a1a';

type Answer = 'yes' | 'no' | 'unknown';
interface Item {
  id: string;
  title: string;
  subtitle: string | null;
  tags: string[];
  attributes: Record<string, number>;
  facets: Record<string, string | string[]>;
  details: Record<string, unknown>;
}
interface Run {
  questions: string[];
  /** La línea "Vale: …" de cada pregunta. */
  leads: string[];
  understanding: Understanding | null;
  entries: { item: Item; reason: string }[];
  notice: string | null;
  anchors: string[];
  ms: number;
}
interface Understanding {
  moods: { key: string; level: 'low' | 'high' }[];
  anchors: unknown[];
  preferences: Record<string, { value: string }>;
  exclusions: string[];
}
interface Scenario {
  id: string;
  domain: string;
  title: string;
  text?: string;
  preferences?: Record<string, string>;
  taste?: { likes: string[]; dislikes?: string[] };
  /** Dueño de los elementos (temas personales). */
  user?: string;
  /** Preguntas a las que una persona que pide esto diría que sí (el resto: sí, no, sí, no…). */
  yes?: RegExp;
  /** Preguntas a las que diría que no. */
  no?: RegExp;
  /** Respuestas libres en lugar del sí/no, por número de pregunta (0 = la primera). */
  replies?: Record<number, string>;
  checks: (run: Run) => (string | null)[];
}

// --- Utilidades para las aserciones ---

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const blob = (it: Item) => norm([it.title, it.subtitle ?? '', it.tags.join(' '), JSON.stringify(it.facets), JSON.stringify(it.details)].join(' '));
const words = (q: string) => q.split(/\s+/).filter(Boolean).length;
const share = (run: Run, pred: (it: Item) => boolean) => run.entries.filter((e) => pred(e.item)).length;
const titles = (run: Run, pred?: (it: Item) => boolean) =>
  run.entries
    .filter((e) => !pred || pred(e.item))
    .map((e) => e.item.title)
    .slice(0, 4)
    .join(' | ');

/** Falla si no se cumple: el mensaje dice qué se esperaba y qué salió. */
const expect = (ok: boolean, message: string) => (ok ? null : message);
const all = (run: Run, pred: (it: Item) => boolean, what: string, min = 6) =>
  expect(run.entries.length >= min && share(run, pred) === run.entries.length, `todas ${what}: ${share(run, pred)}/${run.entries.length} (fuera: ${titles(run, (it) => !pred(it)) || '—'})`);
const most = (run: Run, pred: (it: Item) => boolean, what: string, ratio: number) =>
  expect(run.entries.length > 0 && share(run, pred) / run.entries.length >= ratio, `al menos ${Math.round(ratio * 100)} % ${what}: ${share(run, pred)}/${run.entries.length}`);
const none = (run: Run, pred: (it: Item) => boolean, what: string) =>
  expect(share(run, pred) === 0, `ninguna ${what}: salen ${titles(run, pred)}`);
const avg = (run: Run, key: string) => run.entries.reduce((s, e) => s + (e.item.attributes[key] ?? 0.5), 0) / (run.entries.length || 1);

/** Palabras de géneros musicales y de "sonido": no deben dominar la entrevista de música. */
const GENRE_WORDS = /\b(jazz|rock|clasica|lounge|electronic|guitarra|acustic|sintetizador|sonidos?|genero|estilo|hip hop|reggaeton|regueton|urbano|latino|metal|indie)/;
/** Momento o uso: lo que debe preguntar la música. */
const MOMENT_WORDS = /(entren|deporte|gimnasio|correr|fiesta|gente|relaj|desconect|estudi|trabaj|concentr|conduc|coche|viaje|cantar|fondo|bailar|letra|voz|dormir|cocinar|limpiar|animar|momento|ahora)/;
/** Tecnicismos que no deben salir nunca en una pregunta. */
const JARGON = /\b(entropia|dimension|atributo|ganancia|candidata|faceta|vector|embedding|parametro|algoritmo|tempo|bpm|timbre|textura|atmosferic|minimalista|introspectiv|cinematograf|narrativa|onirico|eclectic)/;

/** Comprobaciones comunes a todas las preguntas de todos los escenarios. */
function questionChecks(run: Run): (string | null)[] {
  const long = run.questions.filter((q) => words(q) > 14);
  const jargon = run.questions.filter((q) => JARGON.test(norm(q)));
  return [
    expect(long.length === 0, `preguntas cortas (≤ 14 palabras): ${long.map((q) => `«${q}»`).join(' ')}`),
    expect(jargon.length === 0, `sin tecnicismos: ${jargon.map((q) => `«${q}»`).join(' ')}`),
  ];
}

const isMarvel = (it: Item) => /marvel/.test(blob(it));
const isNintendo = (it: Item) => /nintendo/.test(norm(JSON.stringify(it.details.developers ?? '') + JSON.stringify(it.details.publishers ?? '')));
const isSpanishTitle = (it: Item) => !/\b(the|of|and|with|from|for|my|your|in)\b/i.test(it.title) || /[áéíóúñ¿¡]/i.test(it.title);
const langs = (it: Item, key: string) => [it.facets[key] ?? []].flat();
const isRomanceMovie = (it: Item) => it.tags.includes('romance') || (it.attributes.romance ?? 0) >= 0.6;
const isRomanceBook = (it: Item) => it.tags.some((t) => ['romance', 'love', 'romántica', 'love stories'].includes(t));

// --- Escenarios ---

const SCENARIOS: Scenario[] = [
  {
    id: 'marvel',
    domain: 'movies',
    title: 'Películas: «quiero algo de Marvel y no sé el qué» → solo Marvel',
    text: 'quiero algo de Marvel y no sé el qué',
    checks: (r) => [all(r, isMarvel, 'de Marvel', 8), expect(r.anchors.some((a) => /marvel/i.test(a)), `Marvel entendido como lo pedido (anclas: ${r.anchors.join(', ') || '—'})`)],
  },
  {
    id: 'marvel-es',
    domain: 'movies',
    title: 'Películas: Marvel con «idioma original: español» guardado → manda lo pedido',
    text: 'quiero algo de Marvel',
    preferences: { language: 'es' },
    checks: (r) => [all(r, isMarvel, 'de Marvel', 8)],
  },
  {
    id: 'free-romance',
    domain: 'movies',
    title: 'Respuesta libre: «no, más romántico» a mitad de la entrevista → la lista se vuelve romántica',
    replies: { 1: 'no, más romántico' },
    checks: (r) => [
      expect(r.leads.some((l) => /romantic/.test(norm(l))), `dice lo que entendió («Vale: más romántica»): ${r.leads.join(' / ')}`),
      most(r, isRomanceMovie, 'románticas', 0.6),
    ],
  },
  {
    id: 'free-nonsense',
    domain: 'movies',
    title: 'Respuesta libre: «eso no tiene sentido» → descarta lo último entendido y pregunta otra cosa',
    replies: { 0: 'algo de terror', 1: 'eso no tiene sentido' },
    checks: (r) => [
      expect(r.leads.some((l) => /descarto/.test(norm(l))), `dice que lo descarta: ${r.leads.join(' / ')}`),
      expect(share(r, (it) => it.tags.includes('terror')) < r.entries.length, `ya no es todo terror (${share(r, (it) => it.tags.includes('terror'))}/${r.entries.length})`),
    ],
  },
  {
    id: 'romance-movies',
    domain: 'movies',
    title: 'Películas: «quiero algo romántico» → romance',
    text: 'quiero algo romántico',
    checks: (r) => [most(r, isRomanceMovie, 'románticas', 0.8)],
  },
  {
    id: 'no-horror',
    domain: 'movies',
    title: 'Películas: «nada de terror, algo para reírme» → sin terror',
    text: 'nada de terror, algo para reírme',
    checks: (r) => [none(r, (it) => it.tags.includes('terror'), 'de terror'), expect(r.entries.length >= 8, `lista completa (${r.entries.length})`)],
  },
  {
    id: 'movies-es',
    domain: 'movies',
    title: 'Películas: idioma español desde los botones',
    preferences: { language: 'es' },
    checks: (r) => [all(r, (it) => langs(it, 'language').includes('es'), 'en español', 6)],
  },
  {
    id: 'books-es',
    domain: 'books',
    title: 'Libros: idioma español desde los botones → solo en español, con título en español',
    preferences: { languages: 'es' },
    checks: (r) => [all(r, (it) => langs(it, 'languages').includes('es') && isSpanishTitle(it), 'en español (y con título en español)', 6)],
  },
  {
    id: 'romance-books',
    domain: 'books',
    title: 'Libros: «quiero algo romántico» → romance',
    text: 'quiero algo romántico',
    checks: (r) => [most(r, isRomanceBook, 'de romance', 0.8)],
  },
  {
    id: 'alas',
    domain: 'books',
    title: 'Libros: «una lista con Alas de sangre y algo parecido» → Alas de sangre primero y parecidos',
    text: 'una lista de libros con Alas de sangre y algo parecido',
    yes: /amor|romantic|magia|dragon|fantasia|engan|aventura/,
    checks: (r) => [
      expect(r.entries[0] && norm(r.entries[0].item.title).includes('alas de sangre'), `Alas de sangre primero (primero: ${r.entries[0]?.item.title ?? '—'})`),
      most(r, (it) => it.tags.some((t) => ['fantasy', 'romance', 'young_adult', 'magic', 'dragons', 'fantasía'].includes(t)), 'parecidos (fantasía o romance juvenil)', 0.7),
    ],
  },
  {
    id: 'author',
    domain: 'books',
    title: 'Libros: «algo de Brandon Sanderson» → solo Sanderson',
    text: 'algo de Brandon Sanderson',
    checks: (r) => [all(r, (it) => /sanderson/.test(blob(it)), 'de Sanderson', 4)],
  },
  {
    id: 'pokemon',
    domain: 'games',
    title: 'Videojuegos: «Pokémon» → solo Pokémon',
    text: 'me apetece un Pokémon',
    checks: (r) => [all(r, (it) => /pokemon/.test(norm(it.title)), 'de Pokémon', 5)],
  },
  {
    id: 'nintendo',
    domain: 'games',
    title: 'Videojuegos: «algo de Nintendo» → solo Nintendo',
    text: 'algo de Nintendo',
    checks: (r) => [all(r, isNintendo, 'de Nintendo (desarrolla o edita)', 6)],
  },
  {
    id: 'platform',
    domain: 'games',
    title: 'Videojuegos: plataforma Nintendo desde los botones',
    preferences: { platforms: 'nintendo' },
    checks: (r) => [all(r, (it) => langs(it, 'platforms').includes('nintendo'), 'para Nintendo', 6)],
  },
  {
    id: 'games-taste',
    domain: 'games',
    title: 'Videojuegos sin texto con gusto por el rol → la lista va con sus gustos',
    taste: { likes: ['@rpg'] },
    checks: (r) => [most(r, (it) => it.tags.some((t) => ['role-playing-games-rpg', 'adventure', 'open-world', 'rpg', 'story-rich', 'fantasy'].includes(t)), 'de rol o aventura', 0.7)],
  },
  {
    id: 'music-urban',
    domain: 'music',
    title: 'Música sin texto con gustos urbanos → preguntas de momento o uso, nada de jazz o rock',
    taste: { likes: ['@urban'] },
    checks: (r) => [
      expect(!r.questions.some((q) => GENRE_WORDS.test(norm(q))), `ninguna pregunta de géneros: ${r.questions.filter((q) => GENRE_WORDS.test(norm(q))).map((q) => `«${q}»`).join(' ') || '—'}`),
      expect(r.questions.filter((q) => MOMENT_WORDS.test(norm(q))).length >= Math.min(2, r.questions.length), `preguntas por el momento o el uso: ${r.questions.map((q) => `«${q}»`).join(' ')}`),
    ],
  },
  {
    id: 'music-plain',
    domain: 'music',
    title: 'Música sin texto ni gustos → empieza por el momento o el uso',
    checks: (r) => [
      expect(r.questions.slice(0, 3).every((q) => MOMENT_WORDS.test(norm(q)) && !GENRE_WORDS.test(norm(q))), `las 3 primeras, de momento o uso: ${r.questions.slice(0, 3).map((q) => `«${q}»`).join(' ')}`),
    ],
  },
  {
    id: 'workout',
    domain: 'music',
    title: 'Música: «algo para entrenar» → energía alta',
    text: 'algo para entrenar',
    yes: /entren|deporte|gimnasio|energia|active/,
    no: /relaj|tranquil|suave|estudi|fondo/,
    checks: (r) => [expect(avg(r, 'energy') >= 0.65, `energía media ≥ 0,65 (sale ${avg(r, 'energy').toFixed(2)})`)],
  },
  {
    id: 'study',
    domain: 'music',
    title: 'Música: «algo para estudiar sin letra» → instrumental y para concentrarse',
    text: 'algo para estudiar sin letra',
    yes: /estudi|trabaj|fondo|suave|tranquil/,
    no: /letra|voz|cantar|fiesta|bailar/,
    checks: (r) => [
      most(r, (it) => (it.attributes.vocal ?? 1) <= 0.35 || it.facets.language === 'instrumental', 'instrumentales', 0.9),
      expect(avg(r, 'focus') >= 0.6, `concentración media ≥ 0,6 (sale ${avg(r, 'focus').toFixed(2)})`),
    ],
  },
  {
    id: 'artist',
    domain: 'music',
    title: 'Música: «pon algo de David TMX» → solo ese artista',
    text: 'pon algo de David TMX',
    checks: (r) => [all(r, (it) => /david tmx/.test(norm(it.subtitle ?? '')), 'de David TMX', 6)],
  },
  {
    id: 'youtube-workout',
    domain: 'youtube',
    title: 'Mi YouTube: «algo para entrenar» con gustos urbanos → energía alta, sin preguntas de jazz o rock',
    text: 'algo para entrenar',
    yes: /entren|deporte|gimnasio|energia|active|perreo/,
    no: /relaj|tranquil|suave|estudi|fondo/,
    taste: { likes: ['@urban'] },
    user: 'youtube',
    checks: (r) => [
      expect(avg(r, 'energy') >= 0.6, `energía media ≥ 0,6 (sale ${avg(r, 'energy').toFixed(2)})`),
      expect(!r.questions.some((q) => /\b(jazz|rock|clasica)/.test(norm(q))), `sin jazz ni rock: ${r.questions.map((q) => `«${q}»`).join(' ')}`),
    ],
  },
  {
    id: 'folder',
    domain: 'folder',
    title: 'Mi carpeta: sin texto → lista de mis canciones',
    user: 'folder',
    checks: (r) => [expect(r.entries.length >= 3, `lista con canciones (${r.entries.length})`)],
  },
];

// --- Recorrido de la web contra la API ---

async function call<T>(path: string, init: RequestInit & { user?: string } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.user ? { 'x-sintonia-user': init.user } : {}), ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

async function tune(sessionId: string) {
  const res = await fetch(`${BASE}/sessions/${sessionId}/tune`);
  if (!res.ok || !res.body) throw new Error(`tune → ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (const line of buffer.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const event = JSON.parse(line.slice(5)) as { step: string; message?: string };
      if (event.step === 'error') throw new Error(`Afinando: ${event.message}`);
      if (event.step === 'done') {
        await reader.cancel();
        return;
      }
    }
    buffer = buffer.slice(buffer.lastIndexOf('\n') + 1);
  }
}

interface View {
  id: string;
  status: string;
  step: number;
  anchors: string[];
  question: { text: string; lead?: string } | null;
}

async function run(s: Scenario, owners: Record<string, string>): Promise<Run> {
  const started = Date.now();
  const user = s.user ? owners[s.user] : EVAL_USER;
  if (s.taste) await call(`/taste/${s.domain}`, { method: 'PUT', user, body: JSON.stringify({ likes: s.taste.likes, dislikes: s.taste.dislikes ?? [] }) });
  else if (!s.user) await call(`/taste/${s.domain}`, { method: 'DELETE', user }).catch(() => null);

  let understanding: Understanding | null = null;
  if (s.text) understanding = await call<Understanding>('/sessions/understand', { method: 'POST', user, body: JSON.stringify({ domainId: s.domain, text: s.text }) });
  const preferences = { ...Object.fromEntries(Object.entries(understanding?.preferences ?? {}).map(([k, v]) => [k, v.value])), ...s.preferences };
  let view = await call<View>('/sessions', {
    method: 'POST',
    user,
    body: JSON.stringify({
      domainId: s.domain,
      initialText: s.text,
      preferences,
      understanding: understanding
        ? { moods: understanding.moods.map(({ key, level }) => ({ key, level })), anchors: understanding.anchors, preferences: {}, exclusions: understanding.exclusions }
        : undefined,
      client: { timeZone: 'Europe/Madrid' },
    }),
  });
  const questions: string[] = [];
  const leads: string[] = [];
  const answerOf = (q: string, i: number): Answer => (s.yes?.test(norm(q)) ? 'yes' : s.no?.test(norm(q)) ? 'no' : i % 2 === 0 ? 'yes' : 'no');
  for (let i = 0; view.status === 'asking' && view.question && i < 14; i++) {
    questions.push(view.question.text);
    leads.push(view.question.lead ?? '');
    const free = s.replies?.[i];
    view = free
      ? await call<View>(`/sessions/${view.id}/reply`, { method: 'POST', body: JSON.stringify({ text: free, step: view.step }) })
      : await call<View>(`/sessions/${view.id}/answers`, { method: 'POST', body: JSON.stringify({ answer: answerOf(view.question.text, i), step: view.step }) });
    if (free && view.question) leads.push(`(tras «${free}») ${view.question.lead ?? ''}`);
  }
  await tune(view.id);
  const result = await call<{ entries: { item: Item; reason: string }[]; notice: string | null; anchors: string[] }>(`/sessions/${view.id}/result`);
  if (s.taste && !s.user) await call(`/taste/${s.domain}`, { method: 'DELETE', user }).catch(() => null);
  return { questions, leads, understanding, entries: result.entries, notice: result.notice, anchors: result.anchors, ms: Date.now() - started };
}

/** Dueños de los temas personales: por parámetro o, en local, el primero que tenga elementos. */
async function personalOwners(): Promise<Record<string, string>> {
  const owners: Record<string, string> = {};
  for (const domain of ['youtube', 'folder']) {
    const given = args.get(`${domain}-user`);
    if (given) owners[domain] = given;
  }
  if (!PROD && config.databaseUrl && (!owners.youtube || !owners.folder)) {
    const { default: postgres } = await import('postgres');
    const sql = postgres(config.databaseUrl, { max: 1 });
    const rows = await sql<{ domain_id: string; owner_id: string }[]>`select distinct on (domain_id) domain_id, owner_id from items where owner_id is not null order by domain_id, owner_id`;
    for (const r of rows) owners[r.domain_id] ??= r.owner_id;
    await sql.end();
  }
  return owners;
}

async function main() {
  const owners = await personalOwners();
  const scenarios = SCENARIOS.filter((s) => (!ONLY.length || ONLY.includes(s.id)) && (!s.user || owners[s.user]));
  const skipped = SCENARIOS.filter((s) => s.user && !owners[s.user] && (!ONLY.length || ONLY.includes(s.id)));
  console.log(`Evals de la entrevista contra ${BASE} (${scenarios.length} escenarios)\n`);
  const rows: { id: string; ok: boolean; ms: number }[] = [];
  for (const s of scenarios) {
    let failures: string[];
    let r: Run | null = null;
    try {
      r = await run(s, owners);
      failures = [...s.checks(r), ...questionChecks(r)].filter((f): f is string => !!f);
    } catch (error) {
      failures = [`error: ${(error as Error).message}`];
    }
    const ok = failures.length === 0;
    rows.push({ id: s.id, ok, ms: r?.ms ?? 0 });
    console.log(`${ok ? '✅' : '❌'} ${s.id.padEnd(16)} ${s.title}${r ? ` (${(r.ms / 1000).toFixed(1)} s, ${r.questions.length} preguntas)` : ''}`);
    for (const f of failures) console.log(`     ✗ ${f}`);
    if (r && (args.has('verbose') || !ok)) {
      for (const q of r.questions) console.log(`     ? ${q}`);
      console.log(`     → ${r.entries.map((e) => e.item.title).join(' | ')}`);
      if (r.notice) console.log(`     ⚠ ${r.notice}`);
    }
  }
  for (const s of skipped) console.log(`⏭  ${s.id.padEnd(16)} ${s.title} (sin dueño: pasa --${s.user}-user=<uuid>)`);
  const passed = rows.filter((r) => r.ok).length;
  console.log(`\n${passed}/${rows.length} en verde`);
  process.exit(passed === rows.length ? 0 : 1);
}

void main();
