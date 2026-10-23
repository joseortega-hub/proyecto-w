// Lógica pura de la entrevista y del ranking: sin IA ni base de datos, fácil de probar.
import type { DomainConfig, Probe } from '../domains/domain.types.js';
import { tasteAffinity, type TasteProfile } from '../taste/taste.engine.js';
import type { InterviewTurn, MoodProfile, SessionPreferences, TextSignals } from './interview.types.js';

/** Cuánto suben los gustos el parecido por atributos (0–1) y la relevancia híbrida (0–1). */
export const TASTE_WEIGHT = { similarity: 0.15, relevance: 0.15 };

export const answered = (turns: InterviewTurn[]) => turns.filter((t) => t.answer !== null);
export const pending = (turns: InterviewTurn[]) => turns.find((t) => t.answer === null) ?? null;

const probeById = (config: DomainConfig) => new Map(config.probes.map((p) => [p.id, p]));

/**
 * Dimensiones (atributos o grupos de etiquetas) sobre las que ya hay información: las
 * de las respuestas y las que ya dejó claras el texto inicial (`known`).
 */
export function informedDimensions(turns: InterviewTurn[], config: DomainConfig, known: Iterable<string> = []): Set<string> {
  const probes = probeById(config);
  const dims = new Set<string>(known);
  for (const t of answered(turns)) {
    if (t.answer === 'unknown') continue;
    probes.get(t.probeId)?.informs.forEach((d) => dims.add(d));
  }
  return dims;
}

/** Confianza del perfil, 0–1: arranca en 0,1 y crece con cada dimensión cubierta. */
export function profileConfidence(turns: InterviewTurn[], config: DomainConfig, known: Iterable<string> = []): number {
  const total = config.attributes.length;
  const covered = informedDimensions(turns, config, known).size;
  return Math.round((0.1 + 0.85 * (covered / total)) * 100) / 100;
}

/** Etiquetas que resumen las respuestas ("con energía", "instrumental"…). "No lo sé" no deja etiqueta. */
export function answerChips(turns: InterviewTurn[], config: DomainConfig): string[] {
  const probes = probeById(config);
  return answered(turns).flatMap((t) => {
    const p = probes.get(t.probeId);
    if (!p || t.answer === 'unknown') return [];
    return [t.answer === 'yes' ? p.yesChip : p.noChip];
  });
}

/** Etiquetas de lo que dejó claro el texto inicial ("tranquilo", "en compañía"). */
export function signalChips(signals: TextSignals, config: DomainConfig): string[] {
  return config.attributes.flatMap((a) => {
    const s = signals[a.key];
    if (!s || a.kind !== 'scale') return [];
    const word = s.value >= 0.5 ? a.highLabel : a.lowLabel;
    return word ? [word] : [];
  });
}

export function remainingProbes(turns: InterviewTurn[], config: DomainConfig): Probe[] {
  const asked = new Set(turns.map((t) => t.probeId));
  return config.probes.filter((p) => !asked.has(p.id));
}

/**
 * Reglas duras de parada. La IA solo puede terminar antes entre el mínimo y el máximo.
 * Con texto inicial, el mínimo baja: lo que ya contó cuenta como respuestas.
 */
export function mustFinish(turns: InterviewTurn[], config: DomainConfig, known: string[] = []): boolean {
  const n = answered(turns).length;
  const { maxQuestions, confidenceToFinish } = config.interview;
  if (n >= maxQuestions || remainingProbes(turns, config).length === 0) return true;
  return n >= minQuestions(config, known) && profileConfidence(turns, config, known) >= confidenceToFinish;
}

/** Mínimo de preguntas: cada dimensión que dejó clara el texto ahorra una, hasta un mínimo de 3. */
export const minQuestions = (config: DomainConfig, known: string[] = []) =>
  Math.max(3, config.interview.minQuestions - known.length);

/** La IA puede proponer terminar a partir del mínimo de preguntas y con algo de confianza. */
export const canFinishEarly = (turns: InterviewTurn[], config: DomainConfig, known: string[] = []) =>
  answered(turns).length >= minQuestions(config, known) && profileConfidence(turns, config, known) >= 0.6;

export interface Rankable {
  id: string;
  subtitle: string | null;
  attributes: Record<string, number>;
  tags: string[];
  popularity: number;
}

/** Aplica los ajustes de la pantalla de resultado ("+ energía"…) sobre el perfil. */
export function applyRefinements(profile: MoodProfile, keys: string[], config: DomainConfig): MoodProfile {
  const scales = { ...profile.scales };
  const informed = new Set(profile.informed);
  for (const key of keys) {
    const r = config.refinements.find((x) => x.key === key);
    if (!r) continue;
    scales[r.attribute] = Math.min(1, Math.max(0, (scales[r.attribute] ?? 0.5) + r.delta));
    informed.add(r.attribute);
  }
  return { ...profile, scales, informed: [...informed] };
}

/**
 * Parecido entre el perfil y un elemento, 0–1. Pesan más los atributos sobre los
 * que la persona respondió; los grupos de etiquetas suman o restan un poco, y los
 * gustos de largo plazo (si los hay) también, sin dejar fuera a nadie.
 */
export function similarity(item: Rankable, profile: MoodProfile, config: DomainConfig, taste?: TasteProfile | null): number {
  let num = 0;
  let den = 0;
  for (const a of config.attributes) {
    if (a.kind !== 'scale') continue;
    const target = profile.scales[a.key];
    const value = item.attributes[a.key];
    if (target === undefined || value === undefined) continue;
    const w = profile.informed.includes(a.key) ? 1 : 0.35;
    num += w * Math.abs(target - value);
    den += w;
  }
  let score = den ? 1 - num / den : 0.5;
  for (const g of config.tagGroups) {
    const p = profile.tagGroups[g.key];
    if (p === undefined) continue;
    if (item.tags.some((t) => g.tags.includes(t))) score += 0.4 * (p - 0.5);
  }
  score += 0.03 * item.popularity;
  score += TASTE_WEIGHT.similarity * tasteAffinity(item, taste, config);
  return Math.min(1, Math.max(0, score));
}

/** Los mejores candidatos, con como mucho `perArtist` elementos del mismo autor. */
export function rankCandidates<T extends Rankable>(
  items: T[],
  profile: MoodProfile,
  config: DomainConfig,
  limit: number,
  perArtist = 2,
  taste?: TasteProfile | null,
): { item: T; score: number }[] {
  const scored = items
    .map((item) => ({ item, score: similarity(item, profile, config, taste) }))
    .sort((a, b) => b.score - a.score);
  const seen = new Map<string, number>();
  const out: { item: T; score: number }[] = [];
  for (const s of scored) {
    const artist = s.item.subtitle ?? s.item.id;
    const count = seen.get(artist) ?? 0;
    if (count >= perArtist) continue;
    seen.set(artist, count + 1);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

// --- Búsqueda semántica (Fase 2) ---

/** Palabra para un valor de escala: la etiqueta baja, la alta o nada si está en medio. */
function scaleWord(value: number, attr: DomainConfig['attributes'][number]): string | null {
  if (value <= 0.35) return attr.lowLabel ?? null;
  if (value >= 0.65) return attr.highLabel ?? null;
  return null;
}

/**
 * Carácter en palabras ("enérgica", "con voz") a partir de valores 0–1. Los valores
 * intermedios no dicen nada y se omiten. Sirve para los prompts de texto: si el modelo no
 * ve cifras, no las copia en las explicaciones.
 */
export function characterWords(values: Record<string, number>, config: DomainConfig): string[] {
  return config.attributes.flatMap((a) => {
    if (a.kind !== 'scale' || values[a.key] === undefined) return [];
    const word = scaleWord(values[a.key], a);
    return word ? [word] : [];
  });
}

/**
 * ¿La explicación cita cifras internas? Valores de 0 a 1 ("tono casi 1.0", "0,85") o
 * porcentajes. Los años o los números de una saga ("1994", "Final Fantasy 7") pasan.
 */
export function hasRawFigures(text: string): boolean {
  return /(^|[^\d.,])(0?[.,]\d+|1[.,]0+)(?![\d.,]*\d)/.test(text) || /\d\s?%/.test(text);
}

/**
 * Texto que representa a un elemento en el espacio de embeddings. Los atributos van
 * en palabras ("tranquila", "instrumental") para que se parezca a la consulta del perfil.
 */
export function itemEmbeddingText(
  item: Pick<Rankable, 'subtitle' | 'attributes' | 'tags'> & {
    title: string;
    description: string | null;
  },
  config: DomainConfig,
  itemNoun: string,
): string {
  const words = config.attributes.flatMap((a) =>
    a.kind === 'scale' && item.attributes[a.key] !== undefined ? [scaleWord(item.attributes[a.key], a)] : [],
  );
  const groups = config.tagGroups.filter((g) => item.tags.some((t) => g.tags.includes(t))).map((g) => g.label);
  return [
    `${itemNoun}: «${item.title}» de ${item.subtitle ?? 'autor desconocido'}`,
    item.description ? `Obra: ${item.description}` : null,
    item.tags.length ? `Etiquetas: ${item.tags.slice(0, 12).join(', ')}` : null,
    groups.length ? `Estilo: ${groups.join(', ')}` : null,
    words.some(Boolean) ? `Carácter: ${words.filter(Boolean).join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('. ');
}

/**
 * Consulta para pgvector a partir del perfil y de las respuestas. Usa el mismo
 * vocabulario que `itemEmbeddingText`. El texto inicial de la persona entra como dato.
 */
export function profileQueryText(
  profile: MoodProfile,
  config: DomainConfig,
  itemNounPlural: string,
  initialText?: string | null,
): string {
  const words = config.attributes.flatMap((a) => {
    if (a.kind !== 'scale' || profile.scales[a.key] === undefined) return [];
    // Sin respuesta directa, solo cuentan los valores claramente marcados.
    const value = profile.scales[a.key];
    if (!profile.informed.includes(a.key) && value > 0.2 && value < 0.8) return [];
    const word = scaleWord(value, a);
    return word ? [word] : [];
  });
  const wanted = config.tagGroups.filter((g) => (profile.tagGroups[g.key] ?? 0) >= 0.6);
  return [
    `${itemNounPlural} ${profile.summary.join(', ') || 'variadas'}`,
    wanted.length ? `Estilo: ${wanted.map((g) => g.label).join(', ')}` : null,
    wanted.length ? `Etiquetas: ${wanted.flatMap((g) => g.tags.slice(0, 4)).join(', ')}` : null,
    words.length ? `Carácter: ${words.join(', ')}` : null,
    initialText ? `Cómo se siente: ${initialText}` : null,
  ]
    .filter(Boolean)
    .join('. ');
}

/** Rango percentil (0–1) de cada valor dentro de la lista; los empates comparten rango. */
export function percentiles(values: number[]): number[] {
  if (values.length <= 1) return values.map(() => 1);
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    const below = sorted.findIndex((x) => x >= v);
    const upTo = sorted.findLastIndex((x) => x <= v);
    return (below + upTo) / 2 / (values.length - 1);
  });
}

export interface HybridCandidate<T> {
  item: T;
  /** Parecido por atributos, 0–1. */
  attr: number;
  /** Similitud coseno con la consulta, o null si el elemento no tiene embedding. */
  semantic: number | null;
  /** Afinidad con los gustos de la persona, −1 a 1 (0 sin perfil de gustos). */
  taste: number;
  /** Relevancia combinada, relativa al resto de candidatos (los gustos la suben o bajan un poco). */
  relevance: number;
}

export interface HybridOptions {
  semanticWeight?: number;
  perArtist?: number;
  /** Gustos de largo plazo: suben la relevancia de lo que encaja, sin excluir el resto. */
  taste?: TasteProfile | null;
}

/**
 * Combina el parecido por atributos con la similitud semántica. Ambos se pasan a
 * percentiles dentro de la bolsa de candidatos para que pesen igual aunque las
 * similitudes coseno vivan en un rango estrecho (≈ 0,6–0,8). Encima, los gustos
 * suman (o restan) un empujón: lo que no encaja con ellos baja, pero no desaparece.
 */
export function hybridRank<T extends Rankable>(
  pool: { item: T; semantic: number | null }[],
  profile: MoodProfile,
  config: DomainConfig,
  limit: number,
  { semanticWeight = 0.5, perArtist = 2, taste = null }: HybridOptions = {},
): HybridCandidate<T>[] {
  const attr = pool.map(({ item }) => similarity(item, profile, config, taste));
  const attrPct = percentiles(attr);
  const withSemantic = pool.map((p, i) => ({ i, s: p.semantic })).filter((p) => p.s !== null);
  const semPct = new Map(percentiles(withSemantic.map((p) => p.s as number)).map((pct, k) => [withSemantic[k].i, pct]));
  const scored = pool
    .map(({ item, semantic }, i) => {
      const s = semPct.get(i);
      const base = s === undefined ? attrPct[i] : (1 - semanticWeight) * attrPct[i] + semanticWeight * s;
      const affinity = tasteAffinity(item, taste, config);
      return { item, attr: attr[i], semantic, taste: affinity, relevance: base + TASTE_WEIGHT.relevance * affinity };
    })
    .sort((a, b) => b.relevance - a.relevance || b.attr - a.attr);

  const seen = new Map<string, number>();
  const out: HybridCandidate<T>[] = [];
  for (const s of scored) {
    const artist = s.item.subtitle ?? s.item.id;
    const count = seen.get(artist) ?? 0;
    if (count >= perArtist) continue;
    seen.set(artist, count + 1);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * % de encaje que se muestra (40–99). Mezcla la relevancia relativa con la
 * probabilidad de encaje del DecisionProvider; sin ella, solo cuenta la relevancia.
 */
export function matchPercent(relevance: number, fit: number | null): number {
  const combined = fit === null ? relevance : 0.45 * relevance + 0.55 * fit;
  return Math.round(40 + 59 * Math.min(1, Math.max(0, combined)));
}

/** Rasgos del elemento que coinciden con el perfil, para las explicaciones. */
export function matchHints(item: Rankable, profile: MoodProfile, config: DomainConfig): string[] {
  const hints: string[] = [];
  for (const a of config.attributes) {
    if (a.kind !== 'scale') continue;
    const target = profile.scales[a.key];
    const value = item.attributes[a.key];
    if (target === undefined || value === undefined || !profile.informed.includes(a.key)) continue;
    const word = scaleWord(value, a);
    if (word && Math.abs(target - value) <= 0.25) hints.push(word);
  }
  for (const g of config.tagGroups) {
    if ((profile.tagGroups[g.key] ?? 0) >= 0.6 && item.tags.some((t) => g.tags.includes(t))) hints.push(g.label);
  }
  return hints;
}

/** Explicación de respaldo cuando el TextProvider no la da: nunca se deja un elemento sin porqué. */
export function fallbackReason(item: Rankable, profile: MoodProfile, config: DomainConfig): string {
  const hints = matchHints(item, profile, config).slice(0, 3);
  if (!hints.length) {
    const tags = item.tags.slice(0, 2);
    return tags.length
      ? `Aporta un toque ${tags.join(' y ')} que encaja con el tono general de la lista.`
      : 'Encaja con el tono general de lo que buscas.';
  }
  const list = hints.length === 1 ? hints[0] : `${hints.slice(0, -1).join(', ')} y ${hints.at(-1)}`;
  return `Está aquí porque es ${list}, justo lo que pediste.`;
}

// --- Preferencias previas (filtros duros) ---

/** Filtro sobre `items.facets`: el elemento pasa si su valor (o alguno de sus valores) está en `values`. */
export interface FacetFilter {
  key: string;
  values: string[];
}

/** Filtros a aplicar en la búsqueda. "Me da igual" no filtra; los valores `alwaysPass` pasan siempre. */
export function preferenceFilters(preferences: SessionPreferences, config: DomainConfig): FacetFilter[] {
  return (config.preferences ?? []).flatMap((pref) => {
    const chosen = preferences[pref.key]?.value;
    if (!chosen || chosen === pref.anyValue || !pref.options.some((o) => o.value === chosen)) return [];
    return [{ key: pref.key, values: [chosen, ...pref.alwaysPass] }];
  });
}

/** Valor de una faceta: uno solo (`es`) o varios (`['pc', 'switch']`). */
export type FacetValue = string | string[];

/** Si la faceta del elemento incluye el valor. */
export const facetHas = (value: FacetValue | undefined, wanted: string) =>
  Array.isArray(value) ? value.includes(wanted) : value === wanted;

/**
 * Aviso cuando un filtro deja pocos elementos del valor elegido y la lista se completa
 * con los que pasan siempre (p. ej. pocas en español → instrumentales). Nunca en silencio.
 */
export function preferenceNotice(
  list: { facets: Record<string, FacetValue> }[],
  preferences: SessionPreferences,
  config: DomainConfig,
  itemNounPlural: string,
  size: number,
): string | null {
  for (const pref of config.preferences ?? []) {
    const chosen = preferences[pref.key]?.value;
    const option = pref.options.find((o) => o.value === chosen);
    if (!option || chosen === pref.anyValue) continue;
    const exact = list.filter((it) => facetHas(it.facets[pref.key], chosen)).length;
    const phrase = option.phrase ?? option.label.toLowerCase();
    const Phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    if (list.length < size) {
      const scope = pref.alwaysPass.length && pref.fillerLabel ? `${Phrase} o ${pref.fillerLabel}` : Phrase;
      return `${scope} solo he encontrado ${list.length} ${itemNounPlural} que encajen.`;
    }
    if (exact === 0) return `${Phrase} no tengo ${itemNounPlural} que encajen, así que te pongo ${pref.fillerLabel}.`;
    if (exact < Math.ceil(size / 2)) {
      return `${Phrase} solo tengo ${exact} ${itemNounPlural} que encajen, así que te completo la lista con ${pref.fillerLabel}.`;
    }
  }
  return null;
}
