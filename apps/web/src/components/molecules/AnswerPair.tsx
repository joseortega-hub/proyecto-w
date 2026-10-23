import { AnswerButton } from '@/components/atoms'
import type { Answer } from '@/lib/api'

interface AnswerPairProps {
  onAnswer: (answer: Answer) => void
  disabled?: boolean
}

/** Sí y No, siempre en el mismo orden, con el "No lo sé" discreto debajo. */
export function AnswerPair({ onAnswer, disabled }: AnswerPairProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 gap-3">
        <AnswerButton answer="yes" disabled={disabled} onClick={() => onAnswer('yes')} />
        <AnswerButton answer="no" disabled={disabled} onClick={() => onAnswer('no')} />
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAnswer('unknown')}
        className="min-h-11 rounded-full px-3 text-[15px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
      >
        No lo sé
      </button>
    </div>
  )
}
