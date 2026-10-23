/**
 * Datos de contexto que acompañan a la entrevista (hora, día de la semana, tiempo).
 * Viajan siempre como datos en el `state` de las decisiones, nunca dentro de las
 * instrucciones. El tiempo sale de Open-Meteo (gratis y sin clave).
 */
import type { DomainConfig } from '../domains/domain.types.js';
import { tasteState, type TasteProfile } from '../taste/taste.engine.js';

export type DayPart = 'madrugada' | 'mañana' | 'mediodía' | 'tarde' | 'noche';

export interface InterviewContext {
  /** Hora local de la persona ("21:05"). */
  hora?: string;
  franja?: DayPart;
  diaSemana?: string;
  finDeSemana?: boolean;
  tiempo?: { descripcion: string; temperaturaC: number; esDeDia?: boolean };
}

/** Lo que manda el navegador: su zona horaria y, si ya dio permiso, su posición aproximada. */
export interface ContextRequest {
  timeZone?: string;
  latitude?: number;
  longitude?: number;
}

export interface ContextDefaults {
  timeZone: string;
  latitude: number;
  longitude: number;
}

const WEATHER_TTL_MS = 15 * 60_000;
const WEATHER_TIMEOUT_MS = 2500;
const weatherCache = new Map<string, { at: number; value: Promise<InterviewContext['tiempo'] | undefined> }>();

const validTimeZone = (tz: string | undefined): tz is string => {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('es-ES', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export function dayPart(hour: number): DayPart {
  if (hour < 6) return 'madrugada';
  if (hour < 12) return 'mañana';
  if (hour < 15) return 'mediodía';
  if (hour < 21) return 'tarde';
  return 'noche';
}

/** Hora, franja y día de la semana en la zona horaria de la persona. */
export function timeContext(now: Date, timeZone: string): Pick<InterviewContext, 'hora' | 'franja' | 'diaSemana' | 'finDeSemana'> {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('es-ES', { timeZone, hour: '2-digit', minute: '2-digit', weekday: 'long', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour);
  const weekday = parts.weekday;
  return {
    hora: `${parts.hour}:${parts.minute}`,
    franja: dayPart(hour),
    diaSemana: weekday,
    // El viernes por la noche ya cuenta como fin de semana.
    finDeSemana: weekday === 'sábado' || weekday === 'domingo' || (weekday === 'viernes' && hour >= 18),
  };
}

/** Códigos WMO de Open-Meteo, en palabras. */
export function describeWeather(code: number): string {
  if (code === 0) return 'despejado';
  if (code <= 2) return 'poco nuboso';
  if (code === 3) return 'nublado';
  if (code === 45 || code === 48) return 'niebla';
  if (code >= 51 && code <= 57) return 'llovizna';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'lluvia';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'nieve';
  if (code >= 95) return 'tormenta';
  return 'variable';
}

/** Tiempo actual en unas coordenadas (redondeadas a ~10 km, por privacidad y para la caché). */
export function fetchWeather(latitude: number, longitude: number, fetchImpl: typeof fetch = fetch) {
  const lat = Math.round(latitude * 10) / 10;
  const lon = Math.round(longitude * 10) / 10;
  const key = `${lat},${lon}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < WEATHER_TTL_MS) return cached.value;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day`;
  const value = fetchImpl(url, { signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
      const body = (await res.json()) as { current?: { temperature_2m: number; weather_code: number; is_day?: number } };
      if (!body.current) throw new Error('Open-Meteo sin datos actuales');
      return {
        descripcion: describeWeather(body.current.weather_code),
        temperaturaC: Math.round(body.current.temperature_2m),
        esDeDia: body.current.is_day === undefined ? undefined : body.current.is_day === 1,
      };
    })
    .catch(() => {
      // Sin tiempo no pasa nada: la entrevista sigue con la hora y el día. Se reintenta pronto.
      weatherCache.delete(key);
      return undefined;
    });
  weatherCache.set(key, { at: Date.now(), value });
  return value;
}

export async function collectContext(
  request: ContextRequest,
  defaults: ContextDefaults,
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<InterviewContext> {
  const timeZone = validTimeZone(request.timeZone) ? request.timeZone : defaults.timeZone;
  const hasCoords = Number.isFinite(request.latitude) && Number.isFinite(request.longitude);
  const tiempo = await fetchWeather(
    hasCoords ? request.latitude! : defaults.latitude,
    hasCoords ? request.longitude! : defaults.longitude,
    fetchImpl,
  );
  return { ...timeContext(now, timeZone), ...(tiempo ? { tiempo } : {}) };
}

/**
 * Clave para reutilizar la primera pregunta: el contexto cambia despacio (franja, día y
 * tiempo), así que la misma pregunta vale para todo el que empiece en ese rato.
 */
export const contextKey = (context: InterviewContext) =>
  [context.franja, context.diaSemana, context.finDeSemana, context.tiempo?.descripcion].join('|');

/** Lo que se sabe de la persona antes de las preguntas, listo para el `state`. */
export function stateExtras(
  session: { context: InterviewContext; initialText: string | null; taste?: TasteProfile | null },
  config: DomainConfig,
) {
  const gustos = tasteState(session.taste, config);
  return {
    contexto: session.context,
    ...(session.initialText ? { textoInicialDeLaPersona: session.initialText } : {}),
    // Gustos de largo plazo: orientan, pero lo que cuenta en la entrevista es el ánimo de ahora.
    ...(gustos ? { gustosDeLaPersona: gustos } : {}),
  };
}
