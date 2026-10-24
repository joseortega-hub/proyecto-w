import { useState } from 'react'
import { Button, Chip, Heading, Icon, Text } from '@/components/atoms'
import { ItemRow } from '@/components/molecules'
import type { Item } from '@/lib/api'
import { careerYears, fameLabel, flagOf, initials, labelYears, LINK_LABELS, originLabel } from '@/lib/perreo-format'
import type { PerreoArtist, PerreoArtistFull } from '@/lib/perreo-types'
import { cn } from '@/lib/utils'

interface ArtistProfileProps {
  artist: PerreoArtistFull
  similar: PerreoArtist[]
  /** Primera lista: sus canciones y las de sus parecidos. */
  firstList: Item[]
  photoUrl: string | null
  activeItemId?: string | null
  playing?: boolean
  onPlay: (index: number) => void
  onMakeList: () => void
  onOpenArtist: (slug: string) => void
  className?: string
}

/** Ficha de un artista: foto, datos, biografía, sellos, enlaces, parecidos y su primera lista. */
export function ArtistProfile({ artist, similar, firstList, photoUrl, activeItemId, playing, onPlay, onMakeList, onOpenArtist, className }: ArtistProfileProps) {
  const [failed, setFailed] = useState(false)
  const years = careerYears(artist.debutYear)
  const origin = originLabel(artist.city, artist.countries)
  return (
    <article className={cn('flex flex-col gap-6', className)}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="size-40 flex-none overflow-hidden rounded-lg bg-domain-soft sm:size-48">
          {photoUrl && !failed ? (
            <img src={photoUrl} alt={`Foto de ${artist.name}`} onError={() => setFailed(true)} className="size-full object-cover object-top" />
          ) : (
            <span aria-hidden className="grid size-full place-items-center font-display text-5xl font-extrabold text-domain">
              {initials(artist.name)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Heading size="display">{artist.name}</Heading>
          {artist.realName && <Text tone="muted">{artist.realName}</Text>}
          <div className="flex flex-wrap gap-1.5">
            {origin && (
              <Chip variant="outline">
                {flagOf(artist.countries[0] ?? '')} {origin}
              </Chip>
            )}
            <Chip variant="outline">{fameLabel(artist.fame)}</Chip>
            {artist.debutYear && (
              <Chip variant="outline">
                Desde {artist.debutYear}
                {years ? ` · ${years} años` : ''}
              </Chip>
            )}
            {artist.styles.map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </div>
      </header>

      <Button onClick={onMakeList} className="self-start">
        <Icon name="sparkles" className="size-5" /> Hazme una lista con {artist.name}
      </Button>

      {artist.bio && (
        <section aria-labelledby="bio" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="bio">
            Su historia
          </Heading>
          <Text size="lead" className="max-w-prose">
            {artist.bio}
          </Text>
          {artist.bioSource && (
            <Text tone="muted" size="xs">
              Fuente: {artist.bioSource}
            </Text>
          )}
        </section>
      )}

      {artist.labels.length > 0 && (
        <section aria-labelledby="labels" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="labels">
            Sellos
          </Heading>
          <ul className="flex flex-col gap-1.5">
            {artist.labels.map((l, i) => (
              <li key={`${l.name}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5 text-[15px]">
                <span>{l.name}</span>
                <span className="font-mono text-sm text-muted-foreground tabular-nums">{labelYears(l.start, l.end)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {firstList.length > 0 && (
        <section aria-labelledby="first-list" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="first-list">
            Para empezar: él y los suyos
          </Heading>
          <ul className="flex flex-col gap-1">
            {firstList.map((item, i) => (
              <li key={item.id}>
                <ItemRow title={item.title} subtitle={item.subtitle} imageUrl={item.imageUrl} durationSec={item.durationSec} active={activeItemId === item.id} playing={playing} onSelect={() => onPlay(i)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {similar.length > 0 && (
        <section aria-labelledby="similar" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="similar">
            Se parecen a él
          </Heading>
          <div className="flex flex-wrap gap-2">
            {similar.map((s) => (
              <button key={s.slug} type="button" onClick={() => onOpenArtist(s.slug)} className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-ring">
                <Chip variant="outline" className="cursor-pointer">
                  {s.name}
                </Chip>
              </button>
            ))}
          </div>
        </section>
      )}

      {Object.keys(artist.links).length > 0 && (
        <section aria-labelledby="links" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="links">
            Escúchalo y síguelo
          </Heading>
          <div className="flex flex-wrap gap-2">
            {Object.entries(artist.links).map(([key, href]) => (
              <a key={key} href={href} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center">
                <Chip variant="outline" className="cursor-pointer">
                  {LINK_LABELS[key] ?? key} ↗
                </Chip>
              </a>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
