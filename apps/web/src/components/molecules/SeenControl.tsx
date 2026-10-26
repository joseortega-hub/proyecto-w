import { Icon } from '@/components/atoms'
import type { SeenRating } from '@/lib/api'
import { RATINGS, type SeenWords } from '@/lib/seen'
import { cn } from '@/lib/utils'

interface SeenControlProps {
  /** Título del elemento, para lectores de pantalla. */
  title: string
  words: SeenWords
  /** `undefined`: sin marcar; `null`: marcado sin valoración. */
  rating: SeenRating | null | undefined
  onChange: (next: { seen: boolean; rating: SeenRating | null }) => void
  /** En filas de lista: sin marcar, solo el icono. */
  compact?: boolean
  disabled?: boolean
  className?: string
}

/**
 * «Ya la vi / Ya lo leí…»: un toque lo marca y aparecen las valoraciones opcionales.
 * Pulsar la valoración elegida la quita; pulsar «Vista» desmarca.
 */
export function SeenControl({ title, words, rating, onChange, compact, disabled, className }: SeenControlProps) {
  const seen = rating !== undefined
  const pill = 'inline-flex min-h-9 touch:min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition-colors duration-200 disabled:opacity-50'
  if (!seen) {
    return (
      <button
        type="button"
        disabled={disabled}
        aria-label={`${words.mark}: ${title}`}
        title={words.mark}
        onClick={() => onChange({ seen: true, rating: null })}
        className={cn(
          compact ? 'grid size-9 touch:size-11 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground' : cn(pill, 'border-[1.5px] border-border bg-card hover:bg-secondary'),
          'disabled:opacity-50',
          className,
        )}
      >
        <Icon name="eye" className="size-[18px]" />
        {!compact && words.mark}
      </button>
    )
  }
  return (
    <div role="group" aria-label={`${words.done}: ${title}`} className={cn('flex flex-wrap items-center gap-1', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-pressed
        aria-label={`Quitar de ${words.section.toLowerCase()}: ${title}`}
        onClick={() => onChange({ seen: false, rating: null })}
        className={cn(pill, 'bg-domain-soft text-domain')}
      >
        <Icon name="check" className="size-4" />
        {words.done}
      </button>
      {RATINGS.map((r) => {
        const on = rating === r.value
        return (
          <button
            key={r.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onChange({ seen: true, rating: on ? null : r.value })}
            className={cn(pill, on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}
          >
            <span aria-hidden>{r.emoji}</span>
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
