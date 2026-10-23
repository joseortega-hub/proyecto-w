import { Cover, Heading, IconButton, MatchBadge, Text } from '@/components/atoms'
import { Explanation, PlaybackControls, SeekBar } from '@/components/molecules'
import type { QueueEntry } from '@/player/player-context'

interface FullPlayerProps {
  entry: QueueEntry
  listTitle: string
  playing: boolean
  position: number
  duration: number
  hasPrevious: boolean
  hasNext: boolean
  onClose: () => void
  onToggle: () => void
  onPrevious: () => void
  onNext: () => void
  onSeek: (s: number) => void
}

/** Reproductor a pantalla completa con la explicación de lo que suena. */
export function FullPlayer({ entry, listTitle, onClose, ...p }: FullPlayerProps) {
  const { item } = entry
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <header className="flex items-center justify-between gap-3">
        <IconButton icon="chevronDown" label="Cerrar reproductor" onClick={onClose} />
        <Text as="span" font="label" className="truncate">
          {listTitle}
        </Text>
        <span className="size-11" aria-hidden />
      </header>
      <Cover src={item.imageUrl} alt={`Portada de ${item.title}`} className="w-full rounded-lg shadow-lg" />
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Heading as="h1" size="section" className="text-[26px] leading-tight">
            {item.title}
          </Heading>
          <Text tone="muted">{item.subtitle}</Text>
        </div>
        {entry.match > 0 && <MatchBadge value={entry.match} />}
      </div>
      <SeekBar position={p.position} duration={p.duration || item.durationSec || 0} onSeek={p.onSeek} />
      <PlaybackControls playing={p.playing} onToggle={p.onToggle} onPrevious={p.onPrevious} onNext={p.onNext} hasPrevious={p.hasPrevious} hasNext={p.hasNext} />
      {entry.reason && <Explanation reason={entry.reason} label="Por qué suena" collapsible={false} />}
      {item.externalUrl && (
        <a href={item.externalUrl} target="_blank" rel="noreferrer" className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline">
          Música con licencia Creative Commons · escuchar en Jamendo
        </a>
      )}
    </div>
  )
}
