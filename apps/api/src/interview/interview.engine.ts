// Lógica pura de la entrevista y del ranking: sin IA ni base de datos, fácil de probar.
import type { DomainConfig, Probe } from '../domains/domain.types.js';
import type { InterviewTurn, MoodProfile } from './interview.types.js';

export const answered = (turns: InterviewTurn[]) => turns.filter((t) => t.answer !== null);
export const pending = (turns: InterviewTurn[]) => turns.find((t) => t.answer === null) ?? null;

const probeById = (config: DomainConfig) => new Map(config.probes.map((p) => [p.id, p]));

/** Dimensiones (atributos o grupos de etiquetas) sobre las que ya hay información. */
export function informedDimensions(turns: InterviewTurn[], config: DomainConfig): Set<string> {
  const probes = probeById(config);
  const dims = new Set<string>();
  for (const t of answered(turns)) {
    if (t.answer === 'unknown') continue;
    probes.get(t.probeId)?.informs.forEach((d) => dims.add(d));
  }
  return dims;
}

/** Confianza del perfil, 0–1: arranca en 0,1 y crece con cada dimensión cubierta. */
export function profileConfidence(turns: InterviewTurn[], config: DomainConfig): number {
  const total = config.attributes.length;
  const covered = informedDimensions(turns, config).size;
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

export function remainingProbes(turns: InterviewTurn[], config: DomainConfig): Probe[] {
  const asked = new Set(turns.map((t) => t.probeId));
  return config.probes.filter((p) => !asked.has(p.id));
}

/** Reglas duras de parada. La IA solo puede terminar antes entre el mínimo y el máximo. */
export function mustFinish(turns: InterviewTurn[], config: DomainConfig): boolean {
  const n = answered(turns).length;
  const { minQuestions, maxQuestions, confidenceToFinish } = config.interview;
  if (n >= maxQuestions || remainingProbes(turns, config).length === 0) return true;
  return n >= minQuestions && profileConfidence(turns, config) >= confidenceToFinish;
}

/** La IA puede proponer terminar a partir del mínimo de preguntas y con algo de confianza. */
export const canFinishEarly = (turns: InterviewTurn[], config: DomainConfig) =>
  answered(turns).length >= config.interview.minQuestions && profileConfidence(turns, config) >= 0.6;

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
 * que la persona respondió; los grupos de etiquetas suman o restan un poco.
 */
export function similarity(item: Rankable, profile: MoodProfile, config: DomainConfig): number {
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
  return Math.min(1, Math.max(0, score));
}

/** Los mejores candidatos, con como mucho `perArtist` elementos del mismo autor. */
export function rankCandidates<T extends Rankable>(
  items: T[],
  profile: MoodProfile,
  config: DomainConfig,
  limit: number,
  perArtist = 2,
): { item: T; score: number }[] {
  const scored = items
    .map((item) => ({ item, score: similarity(item, profile, config) }))
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
