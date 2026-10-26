import { Cover, Heading, IconButton, MatchBadge, Text } from '@/components/atoms'
import { Explanation, FeedbackButtons, PlaybackControls, SeekBar, SeenControl, UpNext, type UpNextEntry } from '@/components/molecules'
import type { Feedback, SeenRating } from '@/lib/api'
import type { SeenWords } from '@/lib/seen'
import type { QueueEntry } from '@/player/player-context'
import type { RepeatMode } from '@/player/queue-order'

interface FullPlayerProps {
  entry: QueueEntry
  listTitle: string
  playing: boolean
  position: number
  duration: number
  hasPrevious: boolean
  hasNext: boolean
  shuffle?: boolean
  repeat?: RepeatMode
  onShuffle?: () => void
  onRepeat?: () => void
  onClose: () => void
  onToggle: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (s: number) => void
  /** Si suena un vídeo de YouTube: hueco donde se coloca su reproductor en lugar de la portada. */
  videoSlot?: (el: HTMLElement | null) => (() => void) | undefined
  /** «A continuación»: lo que suena después en la lista. */
  upNext?: UpNextEntry[]
  /** «Sonó antes»: lo anterior en la lista. */
  previousEntry?: UpNextEntry | null
  onJump?: (index: number) => void
  /** 👍/👎 de lo que suena (perfil de gustos de la temática). */
  feedback?: { value: Feedback | null; onChange: (value: Feedback | null) => void }
  /** «Ya la escuché», en las temáticas que lo tienen. */
  seen?: { words: SeenWords; rating: SeenRating | null | undefined; onChange: (next: { seen: boolean; rating: SeenRating | null }) => void }
}

/** Reproductor a pantalla completa con la explicación de lo que suena. */
export function FullPlayer({ entry, listTitle, onClose, videoSlot, upNext, previousEntry, onJump, feedback, seen, ...p }: FullPlayerProps) {
  const { item } = entry
  const youtube = item.source === 'youtube'
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <header className="flex items-center justify-between gap-3">
        <IconButton icon="chevronDown" label="Cerrar reproductor" onClick={onClose} />
        <Text as="span" font="label" className="truncate">
          {listTitle}
        </Text>
        <span className="size-11" aria-hidden />
      </header>
      {videoSlot ? (
        <div ref={videoSlot} className="aspect-video w-full rounded-lg bg-black" aria-hidden />
      ) : (
        <Cover src={item.imageUrl} alt={`Portada de ${item.title}`} className="w-full rounded-lg shadow-lg" />
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading as="h1" size="section" className="text-[26px] leading-tight">
            {item.title}
          </Heading>
          <Text tone="muted">{item.subtitle}</Text>
        </div>
        {entry.match > 0 && <MatchBadge value={entry.match} />}
      </div>
      {(feedback || seen) && (
        <div className="-mt-2 flex flex-wrap items-center gap-2">
          {feedback && <FeedbackButtons title={item.title} value={feedback.value} onChange={feedback.onChange} />}
          {seen && <SeenControl title={item.title} words={seen.words} rating={seen.rating} onChange={seen.onChange} />}
        </div>
      )}
      <SeekBar position={p.position} duration={p.duration || item.durationSec || 0} onSeek={p.onSeek} />
      <PlaybackControls playing={p.playing} onToggle={p.onToggle} onPrevious={p.onPrevious} onNext={p.onNext} hasPrevious={p.hasPrevious} hasNext={p.hasNext} shuffle={p.shuffle} repeat={p.repeat} onShuffle={p.onShuffle} onRepeat={p.onRepeat} />
      {onJump && <UpNext entries={upNext ?? []} previous={previousEntry} onSelect={onJump} shuffle={p.shuffle} />}
      {entry.reason && <Explanation reason={entry.reason} label="Por qué suena" collapsible={false} />}
      {item.source === 'local' && <Text size="xs" tone="muted" className="text-center">Suena desde tu dispositivo · el archivo no sale de aquí</Text>}
      {item.externalUrl && (
        <a href={item.externalUrl} target="_blank" rel="noreferrer" className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline">
          {youtube ? 'Reproducido con YouTube · abrir en YouTube Music' : 'Música con licencia Creative Commons · escuchar en Jamendo'}
        </a>
      )}
    </div>
  )
}
