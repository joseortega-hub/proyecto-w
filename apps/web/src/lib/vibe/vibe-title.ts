import { levelOf, vibeSpec } from './vibe-spec'

export interface VibeContext {
  franja?: string | null
  diaSemana?: string | null
  finDeSemana?: boolean
  tiempo?: string | null
}

export interface VibeTitle {
  emoji: string
  text: string
  /** "Noche de sábado · lloviendo": el contexto que ha influido. */
  context: string | null
}

const RAIN = /lluvi|llovizn|chubasc|tormenta/i
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Línea de contexto: franja del día, día de la semana y tiempo. Null si no hay nada que decir. */
export function contextLine(ctx: VibeContext | undefined | null): string | null {
  if (!ctx) return null
  const when = ctx.franja ? `${capitalize(ctx.franja)}${ctx.diaSemana ? ` de ${ctx.diaSemana}` : ''}` : ctx.diaSemana ? capitalize(ctx.diaSemana) : null
  return [when, ctx.tiempo].filter(Boolean).join(' · ') || null
}

/**
 * Nombre de la vibra por plantillas: cuadrícula 3×3 según el empuje y el ánimo del perfil,
 * con el día de la semana y la lluvia del contexto. Sin IA: sale al instante y no falla.
 */
export function vibeTitle(domainId: string, scales: Record<string, number>, ctx?: VibeContext | null): VibeTitle {
  const spec = vibeSpec(domainId)
  const drive = levelOf(scales[spec.axes.drive] ?? 0.5)
  const mood = levelOf(scales[spec.axes.mood] ?? 0.5)
  const moodIndex = mood === 'lo' ? 0 : mood === 'mid' ? 1 : 2
  const raining = !!ctx?.tiempo && RAIN.test(ctx.tiempo)
  const raw = raining && drive === 'lo' && mood !== 'lo' ? spec.rainy : spec.titles[drive][moodIndex]
  const dia = ctx?.diaSemana ? capitalize(ctx.diaSemana) : 'Hoy'
  const [emoji, ...rest] = raw.replace('{Dia}', dia).split(' ')
  return { emoji, text: rest.join(' '), context: contextLine(ctx) }
}
