import { Heading, Text } from '@/components/atoms'
import { ItemRow } from '@/components/molecules'
import type { Item } from '@/lib/api'

interface YourYouTubeSongsProps {
  artistName: string
  songs: Item[]
  activeItemId?: string | null
  playing?: boolean
  onPlay: (index: number) => void
}

/** «En tu YouTube» en la ficha del Modo Perreo: los temas del artista que la persona tiene guardados. */
export function YourYouTubeSongs({ artistName, songs, activeItemId, playing, onPlay }: YourYouTubeSongsProps) {
  if (!songs.length) return null
  return (
    <section aria-labelledby="your-youtube" className="flex flex-col gap-2">
      <Heading as="h2" size="section" id="your-youtube">
        En tu YouTube
      </Heading>
      <Text tone="muted">
        {songs.length === 1 ? `Tienes 1 tema de ${artistName} guardado` : `Tienes ${songs.length} temas de ${artistName} guardados`}. Tu rotación, sin filtro 🔥
      </Text>
      <ul className="flex flex-col gap-1">
        {songs.map((item, i) => (
          <li key={item.id}>
            <ItemRow title={item.title} subtitle={item.subtitle} imageUrl={item.imageUrl} durationSec={item.durationSec} active={activeItemId === item.id} playing={playing} onSelect={() => onPlay(i)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
