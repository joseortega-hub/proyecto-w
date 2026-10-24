import { Icon } from '@/components/atoms'
import type { Feedback } from '@/lib/api'
import { cn } from '@/lib/utils'

interface FeedbackButtonsProps {
  /** Título del elemento, para lectores de pantalla. */
  title: string
  value: Feedback | null
  /** Pulsar la opción marcada la quita (`null`). */
  onChange: (value: Feedback | null) => void
  disabled?: boolean
  className?: string
}

/** 👍/👎 por elemento: ajustan el perfil de gustos para las próximas listas. */
export function FeedbackButtons({ title, value, onChange, disabled, className }: FeedbackButtonsProps) {
  const option = (v: Feedback, label: string) => {
    const on = value === v
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${label}: ${title}`}
        title={label}
        disabled={disabled}
        onClick={() => onChange(on ? null : v)}
        className={cn(
          'grid size-9 touch:size-11 place-items-center rounded-full transition-colors duration-200 disabled:opacity-50',
          on ? 'bg-domain-soft text-domain' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )}
      >
        <Icon name={v === 'up' ? 'thumbsUp' : 'thumbsDown'} className={cn('size-[18px]', on && 'fill-current')} />
      </button>
    )
  }
  return (
    <div role="group" aria-label="¿Te encaja?" className={cn('flex items-center gap-0.5', className)}>
      {option('up', 'Me gusta')}
      {option('down', 'No es para mí')}
    </div>
  )
}
