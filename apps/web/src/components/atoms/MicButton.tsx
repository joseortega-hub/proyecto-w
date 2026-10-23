import { Button as UiButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Icon } from './Icon'

interface MicButtonProps {
  listening: boolean
  onClick: () => void
  disabled?: boolean
  className?: string
}

/** 🎤 para dictar. Mientras escucha, late y pasa a "parar". */
export function MicButton({ listening, onClick, disabled, className }: MicButtonProps) {
  const label = listening ? 'Parar el dictado' : 'Dictar con la voz'
  return (
    <UiButton
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={listening}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative size-11 shrink-0 rounded-full transition-colors duration-200',
        listening ? 'bg-domain text-background hover:bg-domain/90' : 'bg-secondary text-foreground hover:bg-border',
        className,
      )}
    >
      {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-domain/40" />}
      <Icon name={listening ? 'stop' : 'mic'} className={cn('relative', listening && 'size-4 fill-current')} />
    </UiButton>
  )
}
