import type { LinkSite } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Monograma y color de cada sitio: icono propio, sin pedir favicons a terceros. */
const SITES: Record<LinkSite, { mark: string; className: string }> = {
  official: { mark: '★', className: 'bg-primary text-primary-foreground' },
  wikipedia: { mark: 'W', className: 'bg-[#f8f9fa] text-[#202122] font-serif ring-1 ring-black/10' },
  fandom: { mark: 'F', className: 'bg-[#fa005a] text-white' },
  tmdb: { mark: 'TM', className: 'bg-[#0d253f] text-[#01b4e4]' },
  rawg: { mark: 'R', className: 'bg-[#151515] text-white' },
  openlibrary: { mark: 'OL', className: 'bg-[#e1dcc5] text-[#1a1a1a]' },
  musicbrainz: { mark: 'MB', className: 'bg-[#ba478f] text-[#fffedb]' },
  reddit: { mark: 'r/', className: 'bg-[#ff4500] text-white' },
  instagram: { mark: 'IG', className: 'bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white' },
  youtube: { mark: '▶', className: 'bg-[#ff0000] text-white' },
  x: { mark: 'X', className: 'bg-black text-white ring-1 ring-white/20' },
}

/** Icono de un sitio enlazado en "Para saber más". Decorativo: el texto del enlace ya dice el sitio. */
export function SiteIcon({ site, className }: { site: LinkSite; className?: string }) {
  const s = SITES[site]
  return (
    <span
      aria-hidden
      className={cn('inline-grid size-8 shrink-0 place-items-center rounded-[9px] text-[12px] font-extrabold leading-none tracking-tight', s.className, className)}
    >
      {s.mark}
    </span>
  )
}
