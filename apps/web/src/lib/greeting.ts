// Saludo de «Hoy para ti»: la frase con el contexto y un degradado según la hora y el tiempo.
// El degradado sale del motor de color compartido (`vibeGradient`, OKLCH): la tinta oscura
// siempre llega a AA sobre los dos extremos.
import type { InterviewContext } from './context'
import { vibeGradient, type VibeGradient } from './vibe/vibe-color'

type Franja = NonNullable<InterviewContext['franja']>

export function franjaOf(hour: number): Franja {
  if (hour < 6) return 'madrugada'
  if (hour < 12) return 'mañana'
  if (hour < 15) return 'mediodía'
  if (hour < 21) return 'tarde'
  return 'noche'
}

/** Contexto local mientras llega el de la API: sin tiempo, pero con hora y día al instante. */
export function localContext(now = new Date()): InterviewContext {
  const diaSemana = now.toLocaleDateString('es-ES', { weekday: 'long' })
  const hour = now.getHours()
  return {
    franja: franjaOf(hour),
    diaSemana,
    finDeSemana: diaSemana === 'sábado' || diaSemana === 'domingo' || (diaSemana === 'viernes' && hour >= 18),
  }
}

const HELLO: Record<Franja, string> = {
  madrugada: 'Buenas noches',
  mañana: 'Buenos días',
  mediodía: 'Buenas tardes',
  tarde: 'Buenas tardes',
  noche: 'Buenas noches',
}

const SKY: Record<string, string> = {
  despejado: 'hace sol',
  'poco nuboso': 'está poco nuboso',
  nublado: 'está nublado',
  niebla: 'hay niebla',
  llovizna: 'llovizna',
  lluvia: 'llueve',
  nieve: 'nieva',
  tormenta: 'hay tormenta',
  variable: 'está variable',
}

/** «Buenas noches · sábado · 14 °C y llueve». Sin tiempo, solo saludo y día. */
export function greetingLine(context: InterviewContext): string {
  const parts: string[] = [HELLO[context.franja ?? 'tarde']]
  if (context.diaSemana) parts.push(context.diaSemana)
  if (context.tiempo) {
    const sky = SKY[context.tiempo.descripcion] ?? context.tiempo.descripcion
    parts.push(`${context.tiempo.temperaturaC} °C y ${sky}`)
  }
  return parts.join(' · ')
}

const DRIVE: Record<Franja, number> = { madrugada: 0.15, mañana: 0.6, mediodía: 0.78, tarde: 0.6, noche: 0.35 }
const SKY_MOOD: Record<string, number> = { despejado: 0.2, 'poco nuboso': 0.1, nublado: -0.1, niebla: -0.15, llovizna: -0.2, lluvia: -0.25, nieve: -0.05, tormenta: -0.3 }

/** Degradado del saludo: la hora fija el empuje (croma) y el tiempo el ánimo (tono). */
export function greetingGradient(context: InterviewContext): VibeGradient {
  const franja = context.franja ?? 'tarde'
  const mood = 0.5 + (SKY_MOOD[context.tiempo?.descripcion ?? ''] ?? 0) + (context.finDeSemana ? 0.08 : 0) - (franja === 'noche' || franja === 'madrugada' ? 0.05 : 0)
  return vibeGradient(DRIVE[franja], Math.min(1, Math.max(0, mood)))
}
