import { Link } from 'react-router'
import { Icon } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface PerreoArtistLinksProps {
  artists: { slug: string; name: string }[]
  className?: string
}

/** En una canción de «Mi YouTube»: enlace a la ficha de cada artista que sale en ella en el Modo Perreo. */
export function PerreoArtistLinks({ artists, className }: PerreoArtistLinksProps) {
  if (!artists.length) return null
  return (
    <nav aria-label="Artistas en el Modo Perreo" className={cn('flex flex-wrap gap-2', className)}>
      {artists.map((a) => (
        <Link
          key={a.slug}
          to={`/perreo/artistas/${a.slug}`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-secondary px-4 text-sm font-bold transition-colors duration-200 ease-standard hover:bg-border"
        >
          <span aria-hidden>🔥</span> Ver a {a.name} en el Modo Perreo
          <Icon name="next" className="size-4 opacity-60" />
        </Link>
      ))}
    </nav>
  )
}
