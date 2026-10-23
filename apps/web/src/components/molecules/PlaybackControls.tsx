import { IconButton } from '@/components/atoms'

interface PlaybackControlsProps {
  playing: boolean
  onToggle: () => void
  onPrevious: () => void
  onNext: () => void
  hasPrevious?: boolean
  hasNext?: boolean
}

export function PlaybackControls({ playing, onToggle, onPrevious, onNext, hasPrevious = true, hasNext = true }: PlaybackControlsProps) {
  return (
    <div className="flex items-center justify-center gap-5">
      <IconButton icon="previous" label="Anterior" variant="ghost" onClick={onPrevious} disabled={!hasPrevious} />
      <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pausar' : 'Reproducir'} variant="primary" size="lg" onClick={onToggle} />
      <IconButton icon="next" label="Siguiente" variant="ghost" onClick={onNext} disabled={!hasNext} />
    </div>
  )
}
