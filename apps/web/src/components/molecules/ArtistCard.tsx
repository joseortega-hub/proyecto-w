import { Chip } from '@/components/atoms'
import { fameLabel, flagOf, initials } from '@/lib/perreo-format'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface ArtistCardProps {
  name: string
  /** Foto del artista; si falta o no carga, sus iniciales. */
  photoUrl?: string | null
  country?: string | null
  debutYear?: number | null
  /** 0 = underground, 100 = mainstream. */
  fame: number
  styles?: string[]
  onOpen?: () => void
  className?: string
}

/** Un artista en la galería del explorador: foto, nombre, origen, fama y estilos. */
export function ArtistCard({ name, photoUrl, country, debutYear, fame, styles = [], onOpen, className }: ArtistCardProps) {
  const [failed, setFailed] = useState(false)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group flex min-h-11 flex-col overflow-hidden rounded-lg border-[1.5px] border-border bg-card text-left transition-[border-color,box-shadow] hover:border-domain hover:shadow-md focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-secondary">
        {photoUrl && !failed ? (
          <img src={photoUrl} alt="" loading="lazy" onError={() => setFailed(true)} className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span aria-hidden className="grid size-full place-items-center bg-domain-soft font-display text-3xl font-extrabold text-domain">
            {initials(name)}
          </span>
        )}
        {country && (
          <span className="absolute top-2 left-2 rounded-full bg-card/90 px-2 py-0.5 text-[13px]" title={country}>
            {flagOf(country.split('/')[0])}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <strong className="truncate font-display text-[16px]">{name}</strong>
        <span className="text-xs text-muted-foreground">
          {fameLabel(fame)}
          {debutYear ? ` · desde ${debutYear}` : ''}
        </span>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`Fama ${fame} de 100`}>
          <div className="h-full rounded-full bg-domain" style={{ width: `${Math.max(4, fame)}%` }} />
        </div>
        {styles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {styles.slice(0, 3).map((s) => (
              <Chip key={s} variant="outline" className="px-2 py-0 text-xs">
                {s}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
