import { Link } from 'react-router'
import { Cover, Icon, IconButton, MatchBadge } from '@/components/atoms'
import { PlaybackControls, SeekBar } from '@/components/molecules'
import type { QueueEntry } from '@/player/player-context'

interface PlayerViewProps {
  entry: QueueEntry
  playing: boolean
  onToggle: () => void
}

/** Mini-reproductor del móvil, encima de la navegación. Al tocarlo se abre el reproductor. */
export function MiniPlayer({ entry, playing, onToggle }: PlayerViewProps) {
  return (
    <div className="mx-2.5 mb-2 flex items-center gap-2.5 rounded-[14px] bg-foreground py-2 pr-1.5 pl-2.5 text-background md:hidden">
      <Link to="/reproductor" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label={`Abrir el reproductor: ${entry.item.title}`}>
        <Cover src={entry.item.imageUrl} alt="" className="size-10 flex-none rounded-[8px]" />
        <span className="flex min-w-0 flex-col">
          <strong className="truncate text-sm">{entry.item.title}</strong>
          <span className="truncate text-xs opacity-75">{entry.item.subtitle}</span>
        </span>
      </Link>
      <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pausar' : 'Reproducir'} variant="ghost" onClick={onToggle} />
    </div>
  )
}

interface PlayerBarProps extends PlayerViewProps {
  position: number
  duration: number
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onSeek: (s: number) => void
}

/** Barra de reproducción de escritorio (≥ 768 px). */
export function PlayerBar({ entry, playing, onToggle, position, duration, hasPrevious, hasNext, onPrevious, onNext, onSeek }: PlayerBarProps) {
  return (
    <div className="hidden items-center gap-6 border-t border-border bg-card px-6 py-3 md:flex">
      <Link to="/reproductor" className="flex w-72 min-w-0 items-center gap-3">
        <Cover src={entry.item.imageUrl} alt="" className="size-12 flex-none rounded-[8px]" />
        <span className="flex min-w-0 flex-col">
          <strong className="truncate text-[15px]">{entry.item.title}</strong>
          <span className="truncate text-[13px] text-muted-foreground">{entry.item.subtitle}</span>
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <div className="[&_[data-size=lg]]:size-12 [&_[data-size=lg]_svg]:size-5">
          <PlaybackControls playing={playing} onToggle={onToggle} onPrevious={onPrevious} onNext={onNext} hasPrevious={hasPrevious} hasNext={hasNext} />
        </div>
        <SeekBar position={position} duration={duration} onSeek={onSeek} />
      </div>
      <div className="flex w-72 items-center justify-end gap-3">
        <MatchBadge value={entry.match} />
        <Link to="/reproductor" className="inline-flex items-center gap-1 text-sm font-bold text-accent-foreground">
          <Icon name="sparkles" className="size-4" /> Por qué suena
        </Link>
      </div>
    </div>
  )
}
