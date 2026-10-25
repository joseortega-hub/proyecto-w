import { IconButton } from '@/components/atoms'
import type { RepeatMode } from '@/player/queue-order'

interface PlaybackControlsProps {
  playing: boolean
  onToggle: () => void
  onPrevious: () => void
  onNext: () => void
  hasPrevious?: boolean
  hasNext?: boolean
  /** Aleatorio y repetir: solo se pintan si llegan sus manejadores. */
  shuffle?: boolean
  repeat?: RepeatMode
  onShuffle?: () => void
  onRepeat?: () => void
}

export const REPEAT_LABEL: Record<RepeatMode, string> = { off: 'Repetir: desactivado', all: 'Repetir toda la lista', one: 'Repetir esta canción' }

export function PlaybackControls({ playing, onToggle, onPrevious, onNext, hasPrevious = true, hasNext = true, shuffle, repeat = 'off', onShuffle, onRepeat }: PlaybackControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-5">
      {onShuffle && <IconButton icon="shuffle" label={shuffle ? 'Aleatorio: activado' : 'Aleatorio: desactivado'} aria-pressed={!!shuffle} variant="ghost" className={shuffle ? 'text-primary' : 'opacity-70'} onClick={onShuffle} />}
      <IconButton icon="previous" label="Anterior" variant="ghost" onClick={onPrevious} disabled={!hasPrevious} />
      <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pausar' : 'Reproducir'} variant="primary" size="lg" onClick={onToggle} />
      <IconButton icon="next" label="Siguiente" variant="ghost" onClick={onNext} disabled={!hasNext} />
      {onRepeat && <IconButton icon={repeat === 'one' ? 'repeatOne' : 'repeat'} label={REPEAT_LABEL[repeat]} aria-pressed={repeat !== 'off'} variant="ghost" className={repeat !== 'off' ? 'text-primary' : 'opacity-70'} onClick={onRepeat} />}
    </div>
  )
}
