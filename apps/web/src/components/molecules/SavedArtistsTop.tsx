import { Link } from 'react-router'
import type { PerreoArtist } from '@/lib/perreo-types'
import { ArtistAvatar } from './PerreoPulseBits'

interface SavedArtistsTopProps {
  top: { artist: PerreoArtist; count: number }[]
  limit?: number
}

/** «Tu más escuchado»: los artistas del Perreo con más temas guardados en tu YouTube. */
export function SavedArtistsTop({ top, limit = 5 }: SavedArtistsTopProps) {
  return (
    <ol className="flex gap-3 overflow-x-auto pb-1">
      {top.slice(0, limit).map(({ artist, count }, i) => (
        <li key={artist.slug} className="flex-none">
          <Link to={`/perreo/artistas/${artist.slug}`} className="flex w-24 flex-col items-center gap-1.5 text-center">
            <span className="relative">
              <ArtistAvatar artist={{ ...artist, photoV: artist.photoV ?? null, color: artist.color ?? null }} size={72} />
              <span className="absolute -top-1 -left-1 grid size-7 place-items-center rounded-full bg-[var(--artist)] font-poster text-base text-black">{i + 1}</span>
            </span>
            <span className="w-full truncate text-sm font-bold text-white">{artist.name}</span>
            <span className="text-xs text-white/65">{count === 1 ? '1 tema' : `${count} temas`}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
