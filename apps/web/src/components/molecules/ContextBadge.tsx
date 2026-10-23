import { Icon, type IconName } from '@/components/atoms'
import type { InterviewContext } from '@/lib/context'
import { cn } from '@/lib/utils'

const WEATHER_ICONS: Record<string, IconName> = {
  despejado: 'sun',
  'poco nuboso': 'cloud',
  nublado: 'cloud',
  niebla: 'fog',
  llovizna: 'rain',
  lluvia: 'rain',
  nieve: 'snow',
  tormenta: 'storm',
}

/** "viernes noche · 15 °C, lluvia" en palabras, o null si no hay contexto. */
export function describeContext(context: InterviewContext): string | null {
  const when = [context.diaSemana, context.franja].filter(Boolean).join(' ')
  const weather = context.tiempo ? `${context.tiempo.temperaturaC} °C, ${context.tiempo.descripcion}` : null
  const text = [when, weather].filter(Boolean).join(' · ')
  return text || null
}

interface ContextBadgeProps {
  context: InterviewContext
  className?: string
}

/** El contexto con el que se adapta la entrevista (día, franja y tiempo), sin preguntar. */
export function ContextBadge({ context, className }: ContextBadgeProps) {
  const text = describeContext(context)
  if (!text) return null
  const night = context.tiempo?.esDeDia === false || context.franja === 'noche' || context.franja === 'madrugada'
  const icon: IconName =
    context.tiempo && WEATHER_ICONS[context.tiempo.descripcion] !== 'sun'
      ? (WEATHER_ICONS[context.tiempo.descripcion] ?? 'cloud')
      : night
        ? 'moon'
        : 'sun'
  return (
    <span
      title="La entrevista tiene en cuenta el día, la hora y el tiempo"
      className={cn('inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[13px] text-muted-foreground', className)}
    >
      <Icon name={icon} className="size-4" />
      {text}
    </span>
  )
}
