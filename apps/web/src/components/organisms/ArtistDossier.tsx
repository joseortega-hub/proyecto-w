import { useState } from 'react'
import { Button, Chip, Heading, Text } from '@/components/atoms'
import { compactNumber } from '@/lib/perreo-format'
import type { PerreoProfile } from '@/lib/perreo-types'
import { cn } from '@/lib/utils'

interface ArtistDossierProps {
  profile: PerreoProfile
  className?: string
}

const TYPE_LABELS: Record<string, string> = { album: 'Álbum', ep: 'EP', single: 'Sencillo', compile: 'Recopilatorio', other: 'Otro' }

/** El expediente completo de un favorito: números, vitrina de premios, lo más visto y la discografía. */
export function ArtistDossier({ profile, className }: ArtistDossierProps) {
  const [allReleases, setAllReleases] = useState(false)
  const stats = [
    { label: 'Oyentes en Last.fm', value: profile.lastfm?.listeners },
    { label: 'Reproducciones en Last.fm', value: profile.lastfm?.playcount },
    { label: 'Fans en Deezer', value: profile.deezer?.fans },
    { label: 'Suscriptores en YouTube', value: profile.youtube?.subscribers },
    { label: 'Visitas en YouTube', value: profile.youtube?.views },
  ].filter((s) => s.value != null)
  const releases = profile.discography ?? []
  const shown = allReleases ? releases : releases.slice(0, 10)
  const topVideos = profile.youtube?.topVideos.slice(0, 5) ?? []
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {stats.length > 0 && (
        <section aria-labelledby="numbers" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="numbers">
            Los números no mienten
          </Heading>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-3">
                <dd className="font-display text-2xl font-extrabold tabular-nums">{compactNumber(s.value)}</dd>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      {!!profile.awards?.length && (
        <section aria-labelledby="awards" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="awards">
            La vitrina
          </Heading>
          <div className="flex flex-wrap gap-1.5">
            {profile.awards.map((a) => (
              <Chip key={a} variant="outline">
                🏆 {a}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {topVideos.length > 0 && (
        <section aria-labelledby="top-videos" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="top-videos">
            Lo que más ha pegado en YouTube
          </Heading>
          <ol className="flex flex-col gap-1.5">
            {topVideos.map((v, i) => (
              <li key={v.id} className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5 text-[15px]">
                <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer noopener" className="min-w-0 break-words hover:underline">
                  {i + 1}. {v.title}
                </a>
                <span className="flex-none font-mono text-sm text-muted-foreground tabular-nums">{compactNumber(v.views)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {releases.length > 0 && (
        <section aria-labelledby="discography" className="flex flex-col gap-2">
          <Heading as="h2" size="section" id="discography">
            Toda la discografía ({releases.length})
          </Heading>
          <ul className="flex flex-col gap-1.5">
            {shown.map((r, i) => (
              <li key={`${r.title}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5 text-[15px]">
                <span className="min-w-0 break-words">
                  {r.title} <span className="text-xs text-muted-foreground">· {TYPE_LABELS[r.type] ?? r.type}</span>
                </span>
                <span className="flex-none font-mono text-sm text-muted-foreground tabular-nums">{r.date?.slice(0, 4) ?? '—'}</span>
              </li>
            ))}
          </ul>
          {releases.length > shown.length && (
            <Button variant="ghost" size="md" className="self-start" onClick={() => setAllReleases(true)}>
              Ver los {releases.length}
            </Button>
          )}
        </section>
      )}

      {!!profile.sources?.length && (
        <Text tone="muted" size="xs">
          Datos de {profile.sources.join(', ')}
          {profile.updatedAt ? ` · al ${profile.updatedAt}` : ''}
        </Text>
      )}
    </div>
  )
}
