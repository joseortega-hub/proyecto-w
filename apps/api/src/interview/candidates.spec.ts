import type { z } from 'zod';
import type { TextProvider } from '../ai/text-provider.js';
import { gamesDomain } from '../domains/games.domain.js';
import { moviesDomain } from '../domains/movies.domain.js';
import { musicDomain } from '../domains/music.domain.js';
import { youtubeDomain } from '../domains/youtube.domain.js';
import { withoutOff, type TasteProfile } from '../taste/taste.engine.js';
import {
  themeTags,
  buildBag,
  coveredProbes,
  currentWeights,
  effectiveCount,
  planNext,
  probeChance,
  probeGain,
  topShare,
  type BagItem,
} from './candidates.js';
import { preferenceFilters } from './interview.engine.js';
import type { Anchor, BagEntry, InterviewTurn } from './interview.types.js';
import { emptyUnderstanding, signalsOf, UnderstandingService } from './understanding.service.js';

const movies = moviesDomain.config;
const games = gamesDomain.config;
const music = musicDomain.config;

let n = 0;
const item = (title: string, o: Partial<BagItem> & { attributes?: Record<string, number> } = {}): BagItem => ({
  id: `it-${++n}`,
  title,
  subtitle: o.subtitle ?? `autor ${n}`,
  description: null,
  attributes: o.attributes ?? {},
  tags: o.tags ?? [],
  facets: o.facets ?? {},
  popularity: 0,
});
const byId = (items: BagItem[]) => new Map(items.map((i) => [i.id, i]));
const turn = (probeId: string, answer: InterviewTurn['answer']): InterviewTurn => ({ probeId, text: '', reason: '', answer });

/** Proveedor de texto falso: devuelve siempre lo mismo (o falla). */
const fakeText = (answer: unknown | Error): TextProvider => ({
  name: 'falso',
  write: async <S extends z.ZodType>({ schema }: { schema: S }) => {
    if (answer instanceof Error) throw answer;
    // Los campos de listas que el escenario no menciona van vacíos, como los devolvería el modelo.
    return schema.parse({ genres: [], picks: [], ...(answer as object) });
  },
});

/**
 * Entrevista simulada: en cada paso pregunta lo que la "IA" (aquí, la primera de las 3 ofrecidas)
 * elige y responde `reply`. Devuelve las sondas preguntadas y las candidatas que quedaban.
 */
function interview(config: typeof movies, bag: BagEntry[], items: Map<string, BagItem>, setup: { known?: string[]; exclusions?: string[] }, reply: (probeId: string) => 'yes' | 'no') {
  const turns: InterviewTurn[] = [];
  const left: number[] = [];
  const firstOffer: string[][] = [];
  for (;;) {
    const plan = planNext({ turns, config, bag, items, known: setup.known ?? [], exclusions: setup.exclusions ?? [] });
    if (plan.finish) return { turns, left, firstOffer, finish: plan.finish, weights: plan.weights };
    expect(plan.offered.length).toBeLessThanOrEqual(3);
    firstOffer.push(plan.offered.map((o) => o.probe.id));
    left.push(plan.left);
    const probe = plan.offered[0].probe;
    turns.push(turn(probe.id, reply(probe.id)));
  }
}

describe('ganancia de información', () => {
  const a = item('A', { attributes: { humor: 0.9 }, tags: ['comedia'] });
  const b = item('B', { attributes: { humor: 0.1 } });
  const bag = (items: BagItem[]) => items.map((i) => ({ id: i.id, w: 1 / items.length }));
  const laugh = movies.probes.find((p) => p.id === 'laugh')!;
  const thrill = movies.probes.find((p) => p.id === 'thrill')!;

  it('una sonda que separa a las candidatas aporta; si todas comparten el rasgo, no aporta nada', () => {
    const split = [a, b, item('C', { attributes: { humor: 0.85 }, tags: ['comedia'] }), item('D', { attributes: { humor: 0.15 } })];
    const same = split.map((i) => item(i.title, { attributes: { humor: 0.9 }, tags: ['comedia'] }));
    expect(probeGain(laugh, bag(split), byId(split), [0.25, 0.25, 0.25, 0.25], movies)).toBeGreaterThan(0.3);
    expect(probeGain(laugh, bag(same), byId(same), [0.25, 0.25, 0.25, 0.25], movies)).toBeLessThan(0.01);
  });

  it('una sonda sobre otra dimensión que no varía no aporta', () => {
    const items = [item('A', { attributes: { humor: 0.9, pace: 0.8 } }), item('B', { attributes: { humor: 0.1, pace: 0.8 } })];
    expect(probeGain(thrill, bag(items), byId(items), [0.5, 0.5], movies)).toBeLessThan(0.01);
  });

  it('nunca pasa de 1 bit y es 0 si todo el peso está en una sola candidata', () => {
    const items = [a, b];
    expect(probeGain(laugh, bag(items), byId(items), [0.5, 0.5], movies)).toBeLessThanOrEqual(1);
    expect(probeGain(laugh, bag(items), byId(items), [1, 0], movies)).toBe(0);
  });

  it('las sondas de estilo miran si el elemento tiene el grupo', () => {
    const scary = movies.probes.find((p) => p.id === 'scary')!;
    expect(probeChance(scary, item('x', { tags: ['terror'] }), movies)).toBeGreaterThan(0.8);
    expect(probeChance(scary, item('y', { tags: ['comedia'] }), movies)).toBeLessThan(0.2);
  });
});

describe('reajuste de pesos', () => {
  const funny = item('Divertida', { attributes: { humor: 0.9 } });
  const serious = item('Seria', { attributes: { humor: 0.1 } });
  const items = [funny, serious];
  const bag: BagEntry[] = items.map((i) => ({ id: i.id, w: 0.5 }));

  it('un "sí" sube a las coherentes y baja a las demás, sin eliminarlas', () => {
    const [wf, ws] = currentWeights(bag, byId(items), [turn('laugh', 'yes')], movies);
    expect(wf).toBeGreaterThan(0.8);
    expect(ws).toBeGreaterThan(0);
    expect(ws).toBeLessThan(0.2);
  });

  it('un "no" hace lo contrario y "no lo sé" no mueve nada', () => {
    const [wf, ws] = currentWeights(bag, byId(items), [turn('laugh', 'no')], movies);
    expect(ws).toBeGreaterThan(wf);
    expect(currentWeights(bag, byId(items), [turn('laugh', 'unknown')], movies)).toEqual([0.5, 0.5]);
  });

  it('las candidatas efectivas bajan con cada respuesta y los pesos siempre suman 1', () => {
    const many = Array.from({ length: 40 }, (_, i) => item(`P${i}`, { attributes: { humor: i / 39, pace: (i * 7 % 40) / 39 } }));
    const big: BagEntry[] = many.map((i) => ({ id: i.id, w: 1 / many.length }));
    const w0 = currentWeights(big, byId(many), [], movies);
    const w1 = currentWeights(big, byId(many), [turn('laugh', 'yes')], movies);
    const w2 = currentWeights(big, byId(many), [turn('laugh', 'yes'), turn('thrill', 'yes')], movies);
    expect(effectiveCount(w0)).toBeCloseTo(40, 3);
    expect(effectiveCount(w1)).toBeLessThan(effectiveCount(w0));
    expect(effectiveCount(w2)).toBeLessThan(effectiveCount(w1));
    expect(w2.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
    expect(topShare(w2, 12)).toBeGreaterThan(topShare(w0, 12));
  });

  it('deshacer es recalcular con una respuesta menos', () => {
    expect(currentWeights(bag, byId(items), [], movies)).toEqual([0.5, 0.5]);
  });
});

describe('escenarios con proveedores falsos', () => {
  const marvelAnchor = {
    label: 'Marvel',
    kind: 'franchise',
    terms: ['Marvel', 'Vengadores', 'Avengers', 'Iron Man', 'Thor', 'Spider-Man'],
    required: true,
  };
  const flat = { pace: 0.8, mood: 0.5, depth: 0.3, romance: 0.3, family: 0.5, era: 0.7 };

  it('"vengo cansado y quiero algo de Marvel" (películas): no pregunta por lo que ya dijo, separa a las de Marvel y la lista es de Marvel', async () => {
    const fake = fakeText({
      anchors: [marvelAnchor],
      moods: [{ dimension: 'depth', level: 'low', confidence: 0.9 }],
      preferences: [],
      exclusions: [],
    });
    const understood = await new UnderstandingService(fake).understand(moviesDomain, 'vengo cansado y quiero algo de Marvel');
    expect(understood.anchors.map((a) => a.label)).toEqual(['Marvel']);
    expect(understood.moods).toEqual([{ key: 'depth', level: 'low', confidence: 0.9 }]);

    // 12 de Marvel que solo se distinguen en el humor + 25 que no lo son.
    const marvel = Array.from({ length: 12 }, (_, i) =>
      item(`Avengers ${i}`, { attributes: { ...flat, humor: i % 2 ? 0.9 : 0.1 }, tags: i % 2 ? ['acción', 'comedia'] : ['acción'] }),
    );
    const others = Array.from({ length: 25 }, (_, i) => item(`Otra ${i}`, { attributes: { ...flat, humor: 0.5 }, tags: ['drama'] }));
    const catalog = [...marvel, ...others];
    const bag = buildBag(catalog, { config: movies, signals: signalsOf(understood), anchors: understood.anchors as Anchor[], exclusions: [], filters: [] });
    expect(bag.mode).toBe('filter');
    expect(bag.entries.every((e) => marvel.some((m) => m.id === e.id))).toBe(true);

    const sim = interview(movies, bag.entries, byId(catalog), { known: ['depth'] }, () => 'yes');
    const asked = sim.turns.map((t) => movies.probes.find((p) => p.id === t.probeId)!);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.some((p) => p.informs.includes('depth'))).toBe(false);
    // Lo que separa a las de Marvel es el humor (el resto es igual en todas).
    expect(asked[0].id).toBe('laugh');
    expect(sim.left[0]).toBeGreaterThan(sim.left.at(-1)!);
    // La lista sale de la bolsa: todo Marvel.
    const best = [...bag.entries].sort((a, b) => b.w - a.w).slice(0, 10);
    expect(best.every((e) => marvel.some((m) => m.id === e.id))).toBe(true);
  });

  it('plataforma Nintendo (videojuegos): la bolsa solo tiene Nintendo', () => {
    const catalog = [
      ...Array.from({ length: 8 }, (_, i) => item(`Nintendo ${i}`, { attributes: { intensity: i / 8 }, facets: { platforms: i % 2 ? ['nintendo', 'pc'] : ['nintendo'] } })),
      ...Array.from({ length: 20 }, (_, i) => item(`PC ${i}`, { attributes: { intensity: i / 20 }, facets: { platforms: ['pc'] } })),
    ];
    const filters = preferenceFilters({ platforms: { value: 'nintendo', source: 'user', confidence: null } }, games);
    const bag = buildBag(catalog, { config: games, signals: {}, anchors: [], exclusions: [], filters });
    expect(bag.entries).toHaveLength(8);
    expect(bag.entries.every((e) => catalog.find((c) => c.id === e.id)!.title.startsWith('Nintendo'))).toBe(true);
  });

  it('"nada de terror": nunca pregunta ni recomienda terror', async () => {
    const fake = fakeText({ anchors: [], moods: [], preferences: [], exclusions: ['horror'] });
    const understood = await new UnderstandingService(fake).understand(moviesDomain, 'algo para esta noche, nada de terror');
    expect(understood.exclusions).toEqual(['horror']);

    const catalog = Array.from({ length: 40 }, (_, i) =>
      item(`Peli ${i}`, {
        attributes: { ...flat, humor: (i % 5) / 4, pace: (i % 7) / 6, mood: (i % 3) / 2 },
        tags: [i % 4 === 0 ? 'terror' : i % 4 === 1 ? 'comedia' : i % 4 === 2 ? 'acción' : 'drama'],
      }),
    );
    const bag = buildBag(catalog, { config: movies, signals: {}, anchors: [], exclusions: understood.exclusions, filters: [] });
    expect(bag.entries.some((e) => catalog.find((c) => c.id === e.id)!.tags.includes('terror'))).toBe(false);
    const sim = interview(movies, bag.entries, byId(catalog), { exclusions: understood.exclusions }, () => 'yes');
    expect(sim.turns.length).toBeGreaterThan(0);
    expect(sim.turns.map((t) => t.probeId)).not.toContain('scary');
    expect(sim.firstOffer.flat()).not.toContain('scary');
  });

  it('idioma español (música): la bolsa respeta el idioma desde la primera pregunta (las instrumentales pasan)', () => {
    const catalog = [
      ...Array.from({ length: 10 }, (_, i) => item(`ES ${i}`, { attributes: { energy: i / 10, vocal: 0.9 }, facets: { language: 'es' } })),
      ...Array.from({ length: 10 }, (_, i) => item(`EN ${i}`, { attributes: { energy: i / 10, vocal: 0.9 }, facets: { language: 'en' } })),
      ...Array.from({ length: 4 }, (_, i) => item(`INS ${i}`, { attributes: { energy: i / 4, vocal: 0.05 }, facets: { language: 'instrumental' } })),
    ];
    const filters = preferenceFilters({ language: { value: 'es', source: 'user', confidence: null } }, music);
    const bag = buildBag(catalog, { config: music, signals: {}, anchors: [], exclusions: [], filters });
    const titles = bag.entries.map((e) => catalog.find((c) => c.id === e.id)!.title);
    expect(titles.some((t) => t.startsWith('EN'))).toBe(false);
    expect(titles.filter((t) => t.startsWith('ES'))).toHaveLength(10);
    const plan = planNext({ turns: [], config: music, bag: bag.entries, items: byId(catalog), known: [], exclusions: [] });
    expect(plan.offered.length).toBeGreaterThan(0);
  });

  it('sin texto: no hay comprensión ni filtros, y si la IA falla se sigue como antes', async () => {
    expect(emptyUnderstanding()).toEqual({ moods: [], anchors: [], preferences: {}, exclusions: [] });
    const failing = await new UnderstandingService(fakeText(new Error('sin cupo'))).understand(moviesDomain, 'algo');
    expect(failing).toEqual(emptyUnderstanding());
    expect(preferenceFilters({ language: { value: 'any', source: 'user', confidence: null } }, movies)).toEqual([]);
  });

  it('las confianzas bajas del texto no cuentan como resueltas y las preferencias "me da igual" se ignoran', async () => {
    const fake = fakeText({
      anchors: [],
      moods: [
        { dimension: 'humor', level: 'high', confidence: 0.4 },
        { dimension: 'pace', level: 'low', confidence: 0.8 },
      ],
      preferences: [{ key: 'language', value: 'any', confidence: 0.9 }],
      exclusions: [],
    });
    const u = await new UnderstandingService(fake).understand(moviesDomain, 'tranqui');
    expect(u.moods.map((m) => m.key)).toEqual(['pace']);
    expect(u.preferences).toEqual({});
  });

  it('"Mi YouTube" con gustos reguetón y trap y sin texto: la lista es de esos estilos y no se pregunta por ellos; sin gustos cambia', () => {
    const yt = youtubeDomain.config;
    const catalog = [
      ...Array.from({ length: 30 }, (_, i) => item(`Otra ${i}`, { attributes: { energy: (i % 6) / 5, dance: (i % 4) / 3 }, tags: [i % 2 ? 'pop' : 'rock'] })),
      ...Array.from({ length: 30 }, (_, i) => item(`Urbana ${i}`, { attributes: { energy: (i % 6) / 5, dance: (i % 4) / 3 }, tags: [i % 2 ? 'reguetón' : 'trap'] })),
    ];
    const taste = { likes: ['reguetón', 'trap'], dislikes: [], learned: {} };
    const top = (t: TasteProfile | null) => {
      const bag = buildBag(catalog, { config: yt, signals: {}, anchors: [], exclusions: [], filters: [], taste: t });
      return { bag, top10: [...bag.entries].sort((a, b) => b.w - a.w).slice(0, 10).map((e) => e.id) };
    };
    const liked = top(taste);
    const isUrban = (id: string) => catalog.find((c) => c.id === id)!.title.startsWith('Urbana');
    expect(liked.top10.filter(isUrban).length).toBeGreaterThanOrEqual(9);
    // Los que no le gustan se quedan en la bolsa con menos peso (margen para descubrir).
    expect(liked.bag.entries.some((e) => !isUrban(e.id))).toBe(true);

    expect(coveredProbes(taste, yt).has('perreo')).toBe(true);
    const plan = planNext({ turns: [], config: yt, bag: liked.bag.entries, items: byId(catalog), known: [], exclusions: [], facts: { skip: coveredProbes(taste, yt) } });
    expect(plan.offered.length).toBeGreaterThan(0);
    expect(plan.offered.map((o) => o.probe.id)).not.toContain('perreo');

    // Con los gustos desactivados en la tarjeta, la lista cambia.
    const off = top(withoutOff(taste, ['reguetón', 'trap']));
    expect(off.top10).not.toEqual(liked.top10);
    expect(off.top10.filter(isUrban).length).toBeLessThan(9);
    expect(coveredProbes(withoutOff(taste, ['reguetón', 'trap']), yt).size).toBe(0);
  });

  it('el ánimo gana a un gusto que lo contradice', () => {
    const calm = item('Calma urbana', { attributes: { energy: 0.1 }, tags: ['reguetón'] });
    const loud = item('Pop fuerte', { attributes: { energy: 0.95 }, tags: ['pop'] });
    const catalog = [calm, loud, item('Pop calmo', { attributes: { energy: 0.1 }, tags: ['pop'] })];
    const taste = { likes: [], dislikes: ['@urban'], learned: {} };
    const bag = buildBag(catalog, { config: youtubeDomain.config, signals: { energy: { value: 0.15, confidence: 1 } }, anchors: [], exclusions: [], filters: [], taste });
    const w = new Map(bag.entries.map((e) => [e.id, e.w]));
    expect(w.get(calm.id)!).toBeGreaterThan(w.get(loud.id)!);
  });
});

describe('themeTags (relleno de «parecido a X» con la temática común)', () => {
  const tg = (...tags: string[]) => ({ tags });
  it('saca lo que distingue al grupo y no los géneros comunes', () => {
    const group = [tg('superhero', 'acción'), tg('superhero', 'acción'), tg('superhero', 'aventura'), tg('cómic', 'acción')];
    const catalog = [...group, ...Array.from({ length: 30 }, () => tg('acción')), ...Array.from({ length: 30 }, () => tg('drama'))];
    const theme = themeTags(group, catalog);
    expect(theme.has('superhero')).toBe(true);
    expect(theme.has('acción')).toBe(false);
  });
  it('con menos de 3 elementos no hay temática', () => {
    expect(themeTags([tg('a'), tg('a')], [tg('a'), tg('b')]).size).toBe(0);
  });
});
