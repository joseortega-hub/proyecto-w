import { cn } from '@/lib/utils'
import { Icon } from './Icon'

export type TasteState = 'none' | 'like' | 'dislike'

interface TasteChipProps {
  label: string
  state: TasteState
  /** Pasa al siguiente estado: nada → me gusta → no me gusta → nada. */
  onToggle: () => void
  className?: string
}

const NEXT: Record<TasteState, string> = {
  none: 'marcar que te gusta',
  like: 'marcar que no te gusta',
  dislike: 'quitar',
}

/** Un gusto que se marca con toques: uno, me gusta (♥); dos, no me gusta (tachado); tres, nada. */
export function TasteChip({ label, state, onToggle, className }: TasteChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${label}: ${state === 'like' ? 'te gusta' : state === 'dislike' ? 'no te gusta' : 'sin marcar'}. Toca para ${NEXT[state]}`}
      className={cn(
        'inline-flex min-h-9 touch:min-h-11 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-sm font-bold transition-colors duration-200',
        state === 'none' && 'border-border bg-card text-foreground hover:bg-secondary',
        state === 'like' && 'border-domain bg-domain-soft text-foreground',
        state === 'dislike' && 'border-dashed border-muted-foreground bg-transparent text-muted-foreground line-through',
        className,
      )}
    >
      {state === 'like' && <Icon name="heart" className="size-3.5 fill-current text-domain" />}
      {state === 'dislike' && <Icon name="close" className="size-3.5" />}
      {label}
    </button>
  )
}
