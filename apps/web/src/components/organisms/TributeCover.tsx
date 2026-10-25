import { useState } from 'react'
import { Button, Heading, Icon, Text } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface TributeCoverProps {
  artistName: string
  /** El apodo que escribió la persona («El Matatán»). */
  nickname?: string
  photoUrl: string | null
  /** Biografía corta del artista (se recorta a las dos primeras frases). */
  bio?: string | null
  /** Cuántas canciones hay en la primera lista. */
  songCount: number
  onPlay: () => void
  onMakeList: () => void
  onExplore: () => void
  className?: string
}

/** Las dos primeras frases de una biografía. */
export const shortBio = (bio: string) => (bio.match(/[^.!?]+[.!?]+(\s|$)/g)?.slice(0, 2).join('').trim() ?? bio).slice(0, 320)

/** Portada de homenaje del Modo Perreo: foto con brillo neón, apodo, biografía y las tres acciones. */
export function TributeCover({ artistName, nickname, photoUrl, bio, songCount, onPlay, onMakeList, onExplore, className }: TributeCoverProps) {
  // Se recuerda qué URL falló: si llega otra (foto nueva), se vuelve a intentar.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = !!photoUrl && failedSrc === photoUrl
  return (
    <section aria-label={`Homenaje a ${artistName}`} data-domain="perreo" className={cn('flex flex-col items-center gap-6 px-4 py-8 text-center', className)}>
      <div className="perreo-glow size-52 overflow-hidden rounded-full border-4 border-domain bg-domain-soft sm:size-64">
        {photoUrl && !failed ? (
          <img src={photoUrl} alt={`Foto de ${artistName}`} onError={() => setFailedSrc(photoUrl)} className="size-full object-cover object-top" />
        ) : (
          <span aria-hidden className="grid size-full place-items-center text-domain">
            <Icon name="flame" className="size-20" />
          </span>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <Text font="label" tone="muted">
          Modo Perreo · homenaje
        </Text>
        <Heading size="display" className="text-domain">
          {nickname || artistName}
        </Heading>
        {nickname && <Text size="lead">{artistName}</Text>}
      </div>
      {bio && (
        <Text className="max-w-prose" size="lead" tone="muted">
          {shortBio(bio)}
        </Text>
      )}
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Button onClick={onPlay} disabled={songCount === 0} block>
          <Icon name="play" className="size-5" /> {songCount ? `Dale play · ${songCount} temas` : 'Aún sin canciones'}
        </Button>
        <Button variant="secondary" onClick={onMakeList} block>
          <Icon name="sparkles" className="size-5" /> Hazme una lista con {artistName}
        </Button>
        <Button variant="ghost" onClick={onExplore} block>
          <Icon name="users" className="size-5" /> Explorar los 66 artistas
        </Button>
      </div>
    </section>
  )
}
