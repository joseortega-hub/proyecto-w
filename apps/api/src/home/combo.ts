/**
 * "El combo de esta noche": una propuesta que cruza temáticas según el contexto (hora, día,
 * tiempo). Lógica pura y sin IA: el perfil de ánimo sale del contexto, el ranking es el de
 * siempre (atributos + gustos) y el «por qué» sale de plantillas con datos reales.
 */
import type { DomainConfig } from '../domains/domain.types.js';
import type { InterviewContext } from '../interview/interview.context.js';
import type { MoodProfile } from '../interview/interview.types.js';

const clamp = (n: number) => Math.round(Math.min(0.95, Math.max(0.05, n)) * 100) / 100;
const RAIN = /lluvia|llovizna|tormenta|nieve|niebla/;

export const isRainy = (context: InterviewContext) => !!context.tiempo && RAIN.test(context.tiempo.descripcion);
const isNight = (context: InterviewContext) => context.franja === 'noche' || context.franja === 'madrugada';

/** Cuánta calma pide el momento (0 = movimiento, 1 = reposo) y cuánta luz (0 = oscuro, 1 = luminoso). */
export function moment(context: InterviewContext) {
  let rest = 0.4;
  if (context.franja === 'noche') rest += 0.3;
  if (context.franja === 'madrugada') rest += 0.4;
  if (context.franja === 'mañana') rest -= 0.05;
  if (isRainy(context)) rest += 0.2;
  let bright = 0.55;
  if (isRainy(context)) bright -= 0.12;
  if (context.tiempo?.descripcion === 'despejado') bright += 0.15;
  if (context.finDeSemana) bright += 0.05;
  if (isNight(context)) bright -= 0.05;
  return { rest: clamp(rest), bright: clamp(bright) };
}

const PUSH = new Set(['energy', 'intensity', 'pace', 'dance', 'challenge']);
const LIGHT = new Set(['positivity', 'mood', 'lightness', 'humor']);

/**
 * Perfil de ánimo derivado solo del contexto: reposo/luz según la hora y el tiempo, y un
 * valor neutro en lo que el contexto no dice. Los gustos de la persona van aparte (ranking).
 */
export function contextProfile(context: InterviewContext, config: DomainConfig): MoodProfile {
  const { rest, bright } = moment(context);
  const scales: Record<string, number> = {};
  for (const a of config.attributes) {
    if (a.kind !== 'scale') continue;
    if (PUSH.has(a.key)) scales[a.key] = clamp(1 - rest);
    else if (LIGHT.has(a.key)) scales[a.key] = bright;
    else if (a.key === 'acoustic') scales[a.key] = clamp(rest);
    else if (a.key === 'depth') scales[a.key] = isNight(context) ? 0.55 : 0.45;
    else if (a.key === 'length') scales[a.key] = context.finDeSemana ? 0.6 : 0.4;
    else if (a.key === 'social') scales[a.key] = context.finDeSemana ? 0.6 : 0.45;
    else scales[a.key] = 0.5;
  }
  return {
    scales,
    tagGroups: Object.fromEntries(config.tagGroups.map((g) => [g.key, 0.5])),
    // Es una suposición del contexto: pesa poco frente a los gustos.
    informed: Object.keys(scales).filter((k) => PUSH.has(k) || LIGHT.has(k)),
    confidence: {},
    summary: [],
  };
}

export interface ComboSlot {
  domainId: string;
  /** Cuándo toca: "para ahora", "para después", "para mañana". */
  role: string;
  /** Cuántos elementos se proponen. */
  count: number;
}

/** Qué temáticas entran en el combo y para cuándo, según el momento del día. */
export function comboSlots(context: InterviewContext, available: string[]): ComboSlot[] {
  const has = (id: string) => available.includes(id);
  const music = has('youtube') ? 'youtube' : 'music';
  const tomorrow = context.finDeSemana ? 'para mañana' : 'para el finde';
  const plan: ComboSlot[] =
    context.franja === 'noche' || context.franja === 'madrugada'
      ? [
          { domainId: 'movies', role: 'para ahora', count: 1 },
          { domainId: music, role: 'para después', count: 2 },
          { domainId: 'games', role: tomorrow, count: 1 },
          { domainId: 'books', role: 'para dormir', count: 1 },
        ]
      : context.franja === 'mañana'
        ? [
            { domainId: music, role: 'para arrancar', count: 2 },
            { domainId: 'books', role: 'para el rato libre', count: 1 },
            { domainId: 'movies', role: 'para esta noche', count: 1 },
            { domainId: 'games', role: tomorrow, count: 1 },
          ]
        : [
            { domainId: music, role: 'para ahora', count: 2 },
            { domainId: 'games', role: 'para el rato libre', count: 1 },
            { domainId: 'movies', role: 'para esta noche', count: 1 },
            { domainId: 'books', role: 'para esta semana', count: 1 },
          ];
  const seen = new Set<string>();
  return plan
    .filter((s) => {
      if (!has(s.domainId) || seen.has(s.domainId)) return false;
      seen.add(s.domainId);
      return true;
    })
    .slice(0, 3);
}

/** "noche de sábado con lluvia" a partir del contexto; null si no hay nada que decir. */
export function momentPhrase(context: InterviewContext): string | null {
  if (!context.franja) return null;
  const base = context.diaSemana ? `${context.franja} de ${context.diaSemana}` : context.franja;
  const sky = isRainy(context) ? ' con lluvia' : context.tiempo?.descripcion === 'despejado' ? ' despejada' : '';
  return `${base}${sky}`;
}

/** Título del combo: "El combo de esta noche", "…de esta mañana", "…de hoy". */
export function comboTitle(context: InterviewContext): string {
  const label: Record<string, string> = { madrugada: 'esta madrugada', mañana: 'esta mañana', mediodía: 'hoy', tarde: 'esta tarde', noche: 'esta noche' };
  return `El combo de ${label[context.franja ?? ''] ?? 'hoy'}`;
}

/** Una línea de por qué ese hueco en este momento ("Noche de sábado con lluvia: algo pausado"). */
export function slotWhy(context: InterviewContext, config: DomainConfig, profile: MoodProfile): string {
  const phrase = momentPhrase(context);
  const drive = config.attributes.find((a) => PUSH.has(a.key) && a.kind === 'scale');
  const value = drive ? profile.scales[drive.key] : undefined;
  const tone = value === undefined ? null : value < 0.4 ? 'algo pausado' : value > 0.6 ? 'algo con ritmo' : 'algo equilibrado';
  const head = phrase ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : 'Ahora';
  return tone ? `${head}: ${tone}` : head;
}

/** Elige `count` de los mejores de forma estable en el día, para que no sea siempre el mismo. */
export function pickStable<T extends { id: string }>(ranked: T[], count: number, seed: string, pool = 8): T[] {
  const top = ranked.slice(0, Math.max(pool, count));
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  // El orden del ranking manda; la fecha solo desempata entre los mejores.
  return top
    .map((item, i) => ({ item, key: i * 0.35 + (hash(seed + item.id) % 1000) / 1000 }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count)
    .map((x) => x.item);
}
