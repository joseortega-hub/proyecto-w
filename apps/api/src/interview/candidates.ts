// Entrevista guiada por candidatas: la bolsa de elementos que aún pueden encajar, con un peso
// cada uno. Lógica pura, sin IA ni base de datos. Cada pregunta se elige por cuánto reduce la
// entropía de la bolsa y cada respuesta sube a las candidatas coherentes y baja a las demás.
import type { DomainConfig, Probe } from '../domains/domain.types.js';
import { coveredGroups, tasteAffinity, tasteOnlyProbes, type TasteProfile } from '../taste/taste.engine.js';
import { ANCHOR_MATCH, anchorMatches, anchorMode, bestAnchor, excludedByAnchors, seedIds, type AnchorItem } from './anchors.js';
import { meetsAny } from './catalog-match.js';
import { askableProbes, type InterviewFacts } from './interview.flow.js';
import { answered, facetHas, minQuestions, probeDirection, remainingProbes, type FacetFilter } from './interview.engine.js';
import type { Anchor, BagEntry, InterviewTurn, TextSignals } from './interview.types.js';

/** Candidatas que se guardan en la sesión como mucho. */
export const BAG_SIZE = 150;
/** La entrevista puede acabar cuando las `TOP_N` mejores suman al menos `TOP_SHARE` del peso. */
export const TOP_N = 12;
export const TOP_SHARE = 0.7;
/** Una respuesta nunca deja a una candidata por debajo de este factor: se baja, no se elimina. */
const ANSWER_FLOOR = 0.06;
/** Por debajo de esta ganancia (en bits) una pregunta no aporta nada. */
export const MIN_GAIN = 0.01;
/** Cuántas preguntas se ofrecen a la IA. */
export const OFFERED = 3;
/** Cuánto pesan los gustos en la bolsa inicial (en el exponente del peso: un gusto que encaja ≈ ×6, un "no me gusta" ≈ ×0,1). */
const TASTE_BAG = 3;
/** Máximo de elementos del mismo creador en la bolsa (salvo si pidió a un creador). */
const PER_CREATOR = 8;
/** Cuánto pesa el parecido con los títulos pedidos ("Alas de sangre y algo parecido"). */
const SEED_BAG = 5;

/**
 * Parecido 0–1 de un elemento con un título pedido: etiquetas en común (géneros, temas) y
 * cercanía en las escalas del dominio. Sin IA ni embeddings, para que funcione siempre.
 */
export function seedSimilarity(item: { tags: string[]; attributes: Record<string, number> }, seed: { tags: string[]; attributes: Record<string, number> }): number {
  const mine = new Set(item.tags);
  const shared = seed.tags.filter((t) => mine.has(t)).length;
  const jaccard = shared / (mine.size + seed.tags.length - shared || 1);
  const keys = Object.keys(seed.attributes).filter((k) => item.attributes[k] !== undefined);
  const close = keys.length ? 1 - keys.reduce((s, k) => s + Math.abs(item.attributes[k] - seed.attributes[k]), 0) / keys.length : 0.5;
  return 0.6 * Math.min(1, jaccard * 2.5) + 0.4 * close;
}

export interface BagItem extends AnchorItem {
  facets: Record<string, string | string[]>;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Etiquetas del grupo (o grupos) de estilo por los que pregunta una sonda. */
export function probeGroups(probe: Probe, config: DomainConfig): string[] {
  const keys = probe.groups ?? [probe.id];
  return keys.filter((k) => config.tagGroups.some((g) => g.key === k));
}

/** Si el elemento tiene alguna etiqueta de los grupos dados. */
export const inGroups = (item: { tags: string[] }, groups: string[], config: DomainConfig) =>
  config.tagGroups.some((g) => groups.includes(g.key) && item.tags.some((t) => g.tags.includes(t)));

/**
 * Probabilidad de que un elemento sea un "sí" para la sonda. Las escalas cuentan por su
 * valor y la dirección de la sonda; los estilos, por si el elemento los tiene. `ignore`
 * deja fuera dimensiones que el texto ya resolvió.
 */
export function probeChance(probe: Probe, item: { attributes: Record<string, number>; tags: string[] }, config: DomainConfig, ignore: ReadonlySet<string> = new Set()): number {
  const parts: number[] = [];
  for (const dim of probe.informs) {
    if (ignore.has(dim)) continue;
    const attr = config.attributes.find((a) => a.key === dim);
    if (!attr) continue;
    if (attr.kind === 'scale') {
      const value = item.attributes[dim];
      if (value === undefined) continue;
      const yes = probeDirection(probe, dim, config) === 'high' ? value : 1 - value;
      parts.push(sigmoid(8 * (yes - 0.5)));
    } else {
      const groups = probeGroups(probe, config);
      if (groups.length) parts.push(inGroups(item, groups, config) ? 0.9 : 0.1);
    }
  }
  return parts.length ? parts.reduce((s, p) => s + p, 0) / parts.length : 0.5;
}

const normalizeWeights = (w: number[]) => {
  const sum = w.reduce((s, x) => s + x, 0);
  return sum > 0 ? w.map((x) => x / sum) : w.map(() => 1 / (w.length || 1));
};

/** Entropía de Shannon en bits. */
export const entropy = (w: number[]) => -w.reduce((s, x) => (x > 0 ? s + x * Math.log2(x) : s), 0);

/** Cuántas candidatas "efectivas" quedan: 2^entropía (150 con pesos iguales; 1 si manda una sola). */
export const effectiveCount = (w: number[]) => (w.length ? 2 ** entropy(w) : 0);

/** Peso que suman las `n` mejores. */
export const topShare = (w: number[], n = TOP_N) => [...w].sort((a, b) => b - a).slice(0, n).reduce((s, x) => s + x, 0);

/** Pesos actuales: los de la bolsa inicial reajustados con cada respuesta (el "no lo sé" no mueve nada). */
export function currentWeights(bag: BagEntry[], items: Map<string, BagItem>, turns: InterviewTurn[], config: DomainConfig, ignore: ReadonlySet<string> = new Set()): number[] {
  const probes = new Map(config.probes.map((p) => [p.id, p]));
  let w = normalizeWeights(bag.map((e) => e.w));
  for (const t of answered(turns)) {
    const probe = probes.get(t.probeId);
    if (!probe || t.answer === 'unknown') continue;
    w = normalizeWeights(
      w.map((x, i) => {
        const item = items.get(bag[i].id);
        const p = item ? probeChance(probe, item, config, ignore) : 0.5;
        return x * Math.max(ANSWER_FLOOR, t.answer === 'yes' ? p : 1 - p);
      }),
    );
  }
  return w;
}

/** Reducción esperada de entropía (bits) al hacer la pregunta: información mutua entre el sí/no y la candidata. */
export function probeGain(probe: Probe, bag: BagEntry[], items: Map<string, BagItem>, weights: number[], config: DomainConfig, ignore: ReadonlySet<string> = new Set()): number {
  const p = bag.map((e) => {
    const item = items.get(e.id);
    return item ? probeChance(probe, item, config, ignore) : 0.5;
  });
  const yes = weights.reduce((s, w, i) => s + w * p[i], 0);
  if (yes < 1e-6 || yes > 1 - 1e-6) return 0;
  const afterYes = weights.map((w, i) => (w * p[i]) / yes);
  const afterNo = weights.map((w, i) => (w * (1 - p[i])) / (1 - yes));
  return Math.max(0, entropy(weights) - yes * entropy(afterYes) - (1 - yes) * entropy(afterNo));
}

export interface RankedProbe {
  probe: Probe;
  gain: number;
}

/**
 * Las sondas por ganancia de información, de más a menos. Las que ya no separan a las
 * candidatas (ganancia ≈ 0: todas comparten ese rasgo) se descartan.
 */
export function rankProbes(probes: Probe[], bag: BagEntry[], items: Map<string, BagItem>, weights: number[], config: DomainConfig, ignore: ReadonlySet<string> = new Set()): RankedProbe[] {
  return probes
    .map((probe) => ({ probe, gain: probeGain(probe, bag, items, weights, config, ignore) }))
    .filter((r) => r.gain >= MIN_GAIN)
    .sort((a, b) => b.gain - a.gain);
}

/**
 * Preguntas de estilo que sobran porque los gustos ya cubren sus grupos ("¿te apetece reguetón?"
 * si le gusta el reguetón). Las que separan dentro de lo que le gusta se siguen haciendo.
 */
export function coveredProbes(taste: TasteProfile | null | undefined, config: DomainConfig): Set<string> {
  const covered = coveredGroups(taste, config);
  const tagOnly = tasteOnlyProbes(config);
  return new Set(
    config.probes
      .filter((p) => tagOnly.has(p.id) && probeGroups(p, config).length > 0 && probeGroups(p, config).every((g) => covered.has(g)))
      .map((p) => p.id),
  );
}

/**
 * Etiquetas que distinguen a un grupo de elementos del resto del catálogo: las que tiene al menos
 * un 40 % del grupo y no más del 20 % del catálogo ("superhero" sí, "acción" no). Con menos de 3
 * elementos no hay temática que sacar.
 */
export function themeTags(group: { tags: string[] }[], catalog: { tags: string[] }[]): Set<string> {
  if (group.length < 3 || !catalog.length) return new Set();
  const count = (items: { tags: string[] }[]) => {
    const m = new Map<string, number>();
    for (const it of items) for (const t of new Set(it.tags)) m.set(t, (m.get(t) ?? 0) + 1);
    return m;
  };
  const inGroup = count(group);
  const inCatalog = count(catalog);
  return new Set([...inGroup].filter(([t, n]) => n / group.length >= 0.4 && (inCatalog.get(t) ?? 0) / catalog.length <= 0.2).map(([t]) => t));
}

export interface BagContext {
  config: DomainConfig;
  signals: TextSignals;
  anchors: Anchor[];
  /** Claves de `tagGroups` que no quiere ("nada de terror"). */
  exclusions: string[];
  filters: FacetFilter[];
  taste?: TasteProfile | null;
  /** Parecido semántico con el texto (0–1) por id, si hubo cupo de embeddings. */
  semantic?: Map<string, number>;
}

/** Cómo se usan las anclas al montar la bolsa, y cuántos elementos casan (para los avisos). */
export interface BagResult {
  entries: BagEntry[];
  mode: 'filter' | 'boost' | 'none';
  matched: number;
}

/**
 * Bolsa inicial: filtros duros (preferencias, exclusiones y anclas pedidas de forma explícita
 * si hay de sobra) y puntuación suave (señales del texto, gustos, anclas, parecido semántico).
 */
export function buildBag<T extends BagItem>(catalog: T[], ctx: BagContext): BagResult {
  const { config } = ctx;
  const excluded = new Set(config.tagGroups.filter((g) => ctx.exclusions.includes(g.key)).flatMap((g) => g.tags));
  // Los títulos pedidos entran siempre, aunque no pasen un filtro: los pidió por su nombre.
  const seeds = new Set(seedIds(ctx.anchors));
  const seedItems = catalog.filter((it) => seeds.has(it.id));
  let scope = catalog.filter(
    (it) =>
      seeds.has(it.id) ||
      (!it.tags.some((t) => excluded.has(t)) && !excludedByAnchors(it, ctx.anchors) && ctx.filters.every((f) => f.values.some((v) => facetHas(it.facets[f.key], v)))),
  );
  // "Parecido a X": lo de X sirve de referencia de parecido (aunque no entre en la lista).
  const references = [...seedItems, ...catalog.filter((it) => !seeds.has(it.id) && ctx.anchors.some((a) => a.like?.length && meetsAny(it, a.like)))];
  const matched = anchorMatches(scope, ctx.anchors);
  const mode = anchorMode(ctx.anchors, matched.length, config.result.size);
  if (mode === 'filter') scope = matched;
  // "Parecido a X" con pocas coincidencias: el relleno comparte la temática de lo encontrado
  // (superhéroes, cómic…), no cualquier cosa de acción.
  else if (ctx.anchors.some((a) => a.similar)) {
    const themed = anchorMatches(scope, ctx.anchors.filter((a) => a.similar));
    const theme = themeTags(themed, scope);
    if (theme.size) scope = scope.filter((it) => it.tags.some((t) => theme.has(t)) || themed.includes(it) || matched.includes(it));
  }

  // Parecido semántico por percentil entre los elementos que lo tienen.
  const semantic = new Map<string, number>();
  if (ctx.semantic?.size) {
    const sorted = [...ctx.semantic.values()].sort((a, b) => a - b);
    for (const it of scope) {
      const s = ctx.semantic.get(it.id);
      if (s !== undefined) semantic.set(it.id, sorted.findIndex((x) => x >= s) / Math.max(1, sorted.length - 1));
    }
  }

  const scored = scope
    .map((item) => {
      let score = 0;
      for (const [dim, signal] of Object.entries(ctx.signals)) {
        const value = item.attributes[dim];
        if (value !== undefined) score += signal.confidence * (1 - Math.abs(signal.value - value) - 0.5) * 4;
      }
      // Con filtro, siguen empujando las anclas que no filtran (artistas de un estilo, parecidos).
      const boosters = mode === 'boost' ? ctx.anchors : ctx.anchors.filter((x) => !x.required);
      if (boosters.length) {
        const { score: a } = bestAnchor(item, boosters);
        if (a >= ANCHOR_MATCH) score += 2 * a;
      }
      if (seeds.has(item.id)) score += 6;
      else if (references.length) score += SEED_BAG * (Math.max(...references.map((seed) => seedSimilarity(item, seed))) - 0.5);
      score += TASTE_BAG * tasteAffinity(item, ctx.taste, config);
      if (semantic.size) score += 2 * ((semantic.get(item.id) ?? 0) - 0.5);
      return { item, w: Math.exp(score) };
    })
    .sort((a, b) => b.w - a.w);

  const perCreator = ctx.anchors.some((a) => a.kind === 'creator') ? BAG_SIZE : PER_CREATOR;
  const seen = new Map<string, number>();
  const picked: { item: T; w: number }[] = [];
  for (const s of scored) {
    const creator = s.item.subtitle ?? s.item.id;
    const count = seen.get(creator) ?? 0;
    if (count >= perCreator) continue;
    seen.set(creator, count + 1);
    picked.push(s);
    if (picked.length >= BAG_SIZE) break;
  }
  const w = normalizeWeights(picked.map((p) => p.w));
  return { entries: picked.map((p, i) => ({ id: p.item.id, w: w[i] })), mode, matched: matched.length };
}

export interface PlanInput {
  turns: InterviewTurn[];
  config: DomainConfig;
  bag: BagEntry[];
  items: Map<string, BagItem>;
  /** Dimensiones de ánimo que ya dejó claras el texto. */
  known: string[];
  /** Claves de `tagGroups` que no quiere. */
  exclusions: string[];
  facts?: InterviewFacts;
}

export interface Plan {
  /** Por qué termina la entrevista; null si sigue. */
  finish: 'max' | 'concentrated' | 'no-gain' | null;
  /** Las mejores preguntas por ganancia (como mucho `OFFERED`). */
  offered: RankedProbe[];
  /** Candidatas efectivas que quedan. */
  left: number;
  weights: number[];
}

/**
 * Qué hacer ahora en una entrevista guiada: terminar (máximo de preguntas, bolsa concentrada
 * o nada que separe ya a las candidatas) o preguntar. Entre las preguntas posibles quedan fuera
 * las ya hechas, las que informan lo que el texto ya dejó claro y las de lo que no quiere.
 */
export function planNext({ turns, config, bag, items, known, exclusions, facts = {} }: PlanInput): Plan {
  const ignore = new Set(known);
  const weights = currentWeights(bag, items, turns, config, ignore);
  const left = effectiveCount(weights);
  const done = answered(turns).length;
  const stop = (finish: Plan['finish']): Plan => ({ finish, offered: [], left, weights });
  if (done && (done >= config.interview.maxQuestions || remainingProbes(turns, config).length === 0)) return stop('max');
  if (done >= minQuestions(config, known) && topShare(weights) >= TOP_SHARE) return stop('concentrated');

  const excluded = new Set(exclusions);
  let options = askableProbes(turns, config, { ...facts, known }).filter((p) => !probeGroups(p, config).some((g) => excluded.has(g)));
  // Lo que ya dejó claro el texto no se vuelve a preguntar, ni de refilón en una sonda doble.
  const clear = options.filter((p) => !p.informs.some((d) => ignore.has(d)));
  if (clear.length) options = clear;
  const ranked = rankProbes(options, bag, items, weights, config, ignore);
  // Si ya nada separa a las candidatas, mejor la lista que preguntas de relleno (tras dos respuestas).
  const pool = ranked.length
    ? ranked
    : done >= 2
      ? []
      : options.map((probe) => ({ probe, gain: probeGain(probe, bag, items, weights, config, ignore) })).sort((a, b) => b.gain - a.gain);
  if (!pool.length) return stop('no-gain');
  return { finish: null, offered: pool.slice(0, OFFERED), left, weights };
}
