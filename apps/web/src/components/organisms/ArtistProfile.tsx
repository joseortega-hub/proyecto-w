import { useState } from 'react'
import { Button, Chip, Heading, Icon, Text } from '@/components/atoms'
import { ItemRow } from '@/components/molecules'
import { ArtistDossier } from './ArtistDossier'
import type { Item } from '@/lib/api'
import { careerYears, fameLabel, flagOf, initials, labelYears, LINK_LABELS, originLabel } from '@/lib/perreo-format'
import { kindName, STATUS_LABELS, type PerreoArtist, type PerreoArtistFull } from '@/lib/perreo-types'
import { cn } from '@/lib/utils'

interface ArtistProfileProps {
  artist: PerreoArtistFull
  similar: PerreoArtist[]
  /** De los parecidos, los que la persona sigue en Instagram. */
  alsoFollow?: PerreoArtist[]
  /** Grupo ↔ miembros: los de un grupo o los grupos de un solista. */
  members?: PerreoArtist[]
  memberOf?: PerreoArtist[]
  /** Primera lista: sus canciones y las de sus parecidos. */
  firstList: Item[]
  photoUrl: string | null
  activeItemId?: string | null
  playing?: boolean
  onPlay: (index: number) => void
  onMakeList: () => void
  onOpenArtist: (slug: string) => void
  /** Abre el formulario para corregir el artista a mano. */
  onEdit?: () => void
  className?: string
}

/** Ficha de un artista: foto, datos, biografía, sellos, enlaces, parecidos y su primera lista. */
export function ArtistProfile({ artist, similar, alsoFollow = [], members = [], memberOf = [], firstList, photoUrl, activeItemId, playing, onPlay, onMakeList, onOpenArtist, onEdit, className }: ArtistProfileProps) {
  // Se recuerda qué URL falló: si llega otra (foto nueva), se vuelve a intentar.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = !!photoUrl && failedSrc === photoUrl
  const years = careerYears(artist.debutYear)
  const origin = originLabel(artist.city, artist.countries)
  return (
    <article className={cn('flex flex-col gap-6', className)}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="size-40 flex-none overflow-hidden rounded-lg bg-domain-soft sm:size-48">
          {photoUrl && !failed ? (
            <img src={photoUrl} alt={`Foto de ${artist.name}`} onError={() => setFailedSrc(photoUrl)} className="size-full object-cover object-top" />
          ) : (
            <span aria-hidden className="grid size-full place-items-center font-display text-5xl font-extrabold text-domain">
              {initials(artist.name)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Heading size="display" className="break-words">{artist.name}</Heading>
          {artist.nickname && <Text className="font-bold text-domain break-words">«{artist.nickname}»</Text>}
          {artist.realName && <Text tone="muted">{artist.realName}</Text>}
          {!!artist.aliases?.length && <Text tone="muted" size="sm">También: {artist.aliases.join(' · ')}</Text>}
          <div className="flex flex-wrap gap-1.5">
            {artist.favoriteRank != null && <Chip title={`Tu favorito n.º ${artist.favoriteRank}`}>★ De tus favs</Chip>}
            {artist.source === 'youtube' && <Chip variant="outline" title="Ficha nueva sacada de tu «Mi YouTube»">▶ De tu YouTube</Chip>}
            {origin && (
              <Chip variant="outline">
                {flagOf(artist.countries[0] ?? '')} {origin}
              </Chip>
            )}
            {artist.kind !== 'artist' && <Chip variant="outline">{kindName(artist.kind)}</Chip>}
            {artist.incomplete && <Chip variant="outline">Por completar</Chip>}
            {artist.status && artist.status !== 'active' && (
              <Chip variant="outline">
                {STATUS_LABELS[artist.status] ?? artist.status}
                {artist.activeUntil ? ` en ${artist.activeUntil}` : ''}
              </Chip>
            )}
            <Chip variant="outline">{fameLabel(artist.fame)}</Chip>
            {artist.streetLevel != null && <Chip variant="outline">Calle {artist.streetLevel}/100</Chip>}
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

      <div className="flex min-w-0 flex-wrap gap-2">
        {(artist.kind === 'artist' || artist.kind === 'group') && !artist.incomplete && (
          <Button onClick={onMakeList} className="h-auto min-h-13 max-w-full whitespace-normal py-2 text-left">
            <Icon name="sparkles" className="size-5 flex-none" /> <span className="min-w-0 break-words">Hazme una lista con {artist.name}</span>
          </Button>
        )}
        {onEdit && (
          <Button variant="secondary" size="lg" onClick={onEdit}>
            <Icon name="edit" className="size-5" /> Editar
          </Button>
        )}
      </div>

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

      {(members.length > 0 || memberOf.length > 0) && (
        <section aria-labelledby="crew" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="crew">
            {members.length ? 'El combo' : 'También en el combo'}
          </Heading>
          <div className="flex flex-wrap gap-2">
            {[...members, ...memberOf].map((s) => (
              <button key={s.slug} type="button" onClick={() => onOpenArtist(s.slug)} className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-ring">
                <Chip className="cursor-pointer">{s.name}</Chip>
              </button>
            ))}
          </div>
        </section>
      )}

      {artist.profile && <ArtistDossier profile={artist.profile} />}

      {artist.labels.length > 0 && (
        <section aria-labelledby="labels" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="labels">
            Sellos
          </Heading>
          <ul className="flex flex-col gap-1.5">
            {artist.labels.map((l, i) => (
              <li key={`${l.name}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5 text-[15px]">
                <span className="min-w-0 break-words">{l.name}</span>
                <span className="flex-none font-mono text-sm text-muted-foreground tabular-nums">{labelYears(l.start, l.end)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!artist.collaborators?.length && (
        <section aria-labelledby="collabs" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="collabs">
            Colabora con
          </Heading>
          <div className="flex flex-wrap gap-1.5">
            {artist.collaborators.map((c) => (
              <Chip key={c} variant="outline">
                {c}
              </Chip>
            ))}
          </div>
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

      {alsoFollow.length > 0 && (
        <section aria-labelledby="also-follow" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="also-follow">
            También sigues a…
          </Heading>
          <div className="flex flex-wrap gap-2">
            {alsoFollow.map((s) => (
              <button key={s.slug} type="button" onClick={() => onOpenArtist(s.slug)} className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-ring">
                <Chip className="cursor-pointer">♥ {s.name}</Chip>
              </button>
            ))}
          </div>
        </section>
      )}

      {similar.filter((s) => !alsoFollow.some((f) => f.slug === s.slug)).length > 0 && (
        <section aria-labelledby="similar" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="similar">
            Se parecen a él
          </Heading>
          <div className="flex flex-wrap gap-2">
            {similar.filter((s) => !alsoFollow.some((f) => f.slug === s.slug)).map((s) => (
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
