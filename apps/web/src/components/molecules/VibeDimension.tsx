import { VibeSlider, VibeSourceIcon, isVerticalVibe, type VibeSourceKey } from '@/components/atoms'
import { cn } from '@/lib/utils'
import type { VibeVariant } from '@/lib/vibe/vibe-spec'
import { levelWord, type VibeAttribute } from '@/lib/vibe/vibe-words'

interface VibeDimensionProps {
  attribute: VibeAttribute & { description?: string }
  value: number
  source: VibeSourceKey
  /** Seguro (sólido) o supuesto (punteado). */
  solid: boolean
  variant: VibeVariant
  disabled?: boolean
  onChange?: (value: number) => void
  onCommit?: (value: number) => void
}

/** Una dimensión de la vibra: su barra, su nombre, la palabra que la describe y de dónde sale. */
export function VibeDimension({ attribute, value, source, solid, variant, disabled, onChange, onCommit }: VibeDimensionProps) {
  const word = levelWord(value, attribute)
  const slider = (
    <VibeSlider
      label={attribute.label}
      value={value}
      valueText={`${attribute.label}: ${word}`}
      variant={variant}
      solid={solid}
      disabled={disabled}
      onChange={onChange}
      onCommit={onCommit}
    />
  )
  if (isVerticalVibe(variant)) {
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={attribute.description}>
        <span className="flex items-end min-h-8 text-center text-xs leading-tight text-muted-foreground" aria-hidden>
          {word}
        </span>
        {slider}
        <span className="text-center text-xs font-bold leading-tight">{attribute.label}</span>
        <VibeSourceIcon source={source} solid={solid} />
      </div>
    )
  }
  return (
    <div className={cn('flex flex-col gap-1.5', variant === 'hud' && 'font-mono')} title={attribute.description}>
      <div className="flex items-center gap-2">
        <VibeSourceIcon source={source} solid={solid} />
        <span className={cn('text-sm font-bold', variant === 'hud' && 'uppercase tracking-wider')}>{attribute.label}</span>
        <span className="ml-auto text-right text-xs text-muted-foreground" aria-hidden>
          {word}
        </span>
      </div>
      {slider}
    </div>
  )
}
