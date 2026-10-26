import { Link } from 'react-router'
import { Cover, Icon, IconButton, MatchBadge } from '@/components/atoms'
import { PlaybackControls, SeekBar } from '@/components/molecules'
import { REPEAT_LABEL } from '@/components/molecules/PlaybackControls'
import { cn } from '@/lib/utils'
import { usePlayerVideoSlot, type QueueEntry } from '@/player/player-context'
import type { RepeatMode } from '@/player/queue-order'

interface PlayerViewProps {
  entry: QueueEntry
  playing: boolean
  onToggle: () => void
  /** Si suena un vídeo de YouTube: hueco donde se ve, en lugar de la portada. */
  videoSlot?: (el: HTMLElement | null) => (() => void) | undefined
  shuffle?: boolean
  repeat?: RepeatMode
  onShuffle?: () => void
  onRepeat?: () => void
  /** Cierra el reproductor (para y vacía la cola). */
  onClose?: () => void
}

/** Mini-reproductor del móvil, encima de la navegación. Al tocarlo se abre el reproductor. */
export function MiniPlayer({ entry, playing, onToggle, videoSlot: slotProp, shuffle, repeat = 'off', onShuffle, onRepeat, onClose }: PlayerViewProps) {
  // El hook va siempre (reglas de los hooks); la prop, si llega, manda.
  const contextSlot = usePlayerVideoSlot()
  const videoSlot = slotProp ?? contextSlot
  return (
    <div className="mx-2.5 mb-2 flex flex-none items-center gap-2.5 rounded-[14px] bg-foreground py-2 pr-1.5 pl-2.5 text-background md:hidden">
      <Link to="/reproductor" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label={`Abrir el reproductor: ${entry.item.title}`}>
        {videoSlot ? (
          <span ref={videoSlot} className="aspect-video h-10 flex-none rounded-[8px] bg-black" aria-hidden />
        ) : (
          <Cover src={entry.item.imageUrl} alt="" className="size-10 flex-none rounded-[8px]" />
        )}
        <span className="flex min-w-0 flex-col">
          <strong className="truncate text-sm">{entry.item.title}</strong>
          <span className="truncate text-xs opacity-75">{entry.item.subtitle}</span>
        </span>
      </Link>
      {/* En pantallas estrechas, aleatorio y repetir quedan en el reproductor completo: la ✕ siempre cabe. */}
      {onShuffle && <IconButton icon="shuffle" label={shuffle ? 'Aleatorio: activado' : 'Aleatorio: desactivado'} aria-pressed={!!shuffle} variant="ghost" className={cn('max-[399px]:hidden', shuffle ? 'text-primary-foreground bg-primary/80' : 'opacity-70')} onClick={onShuffle} />}
      {onRepeat && <IconButton icon={repeat === 'one' ? 'repeatOne' : 'repeat'} label={REPEAT_LABEL[repeat]} aria-pressed={repeat !== 'off'} variant="ghost" className={cn('max-[399px]:hidden', repeat !== 'off' ? 'text-primary-foreground bg-primary/80' : 'opacity-70')} onClick={onRepeat} />}
      <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pausar' : 'Reproducir'} variant="ghost" onClick={onToggle} />
      {onClose && <IconButton icon="close" label="Parar y cerrar el reproductor" variant="ghost" onClick={onClose} />}
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
export function PlayerBar({ entry, playing, onToggle, position, duration, hasPrevious, hasNext, onPrevious, onNext, onSeek, videoSlot: slotProp, shuffle, repeat, onShuffle, onRepeat, onClose }: PlayerBarProps) {
  // El hook va siempre (reglas de los hooks); la prop, si llega, manda.
  const contextSlot = usePlayerVideoSlot()
  const videoSlot = slotProp ?? contextSlot
  return (
    <div className="hidden flex-none items-center gap-6 border-t border-border bg-card px-6 py-3 md:flex">
      <Link to="/reproductor" className="flex w-72 min-w-0 items-center gap-3">
        {videoSlot ? (
          <span ref={videoSlot} className="aspect-video h-12 flex-none rounded-[8px] bg-black" aria-hidden />
        ) : (
          <Cover src={entry.item.imageUrl} alt="" className="size-12 flex-none rounded-[8px]" />
        )}
        <span className="flex min-w-0 flex-col">
          <strong className="truncate text-[15px]">{entry.item.title}</strong>
          <span className="truncate text-[13px] text-muted-foreground">{entry.item.subtitle}</span>
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-1">
        <div className="[&_[data-size=lg]]:size-12 [&_[data-size=lg]_svg]:size-5">
          <PlaybackControls playing={playing} onToggle={onToggle} onPrevious={onPrevious} onNext={onNext} hasPrevious={hasPrevious} hasNext={hasNext} shuffle={shuffle} repeat={repeat} onShuffle={onShuffle} onRepeat={onRepeat} />
        </div>
        <SeekBar position={position} duration={duration} onSeek={onSeek} />
      </div>
      <div className="flex w-72 items-center justify-end gap-3">
        {/* Desde la ficha se reproduce una canción suelta: sin encaje ni explicación que enseñar. */}
        {entry.match > 0 && <MatchBadge value={entry.match} />}
        {entry.reason && (
          <Link to="/reproductor" className="inline-flex items-center gap-1 text-sm font-bold text-accent-foreground">
            <Icon name="sparkles" className="size-4" /> Por qué suena
          </Link>
        )}
        {onClose && <IconButton icon="close" label="Parar y cerrar el reproductor" variant="ghost" onClick={onClose} />}
      </div>
    </div>
  )
}
