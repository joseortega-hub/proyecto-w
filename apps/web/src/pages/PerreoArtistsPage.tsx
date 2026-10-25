import { useDeferredValue, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Heading, Text } from '@/components/atoms'
import { ArtistExplorer } from '@/components/organisms'
import { photoUrl, usePerreoArtists, usePerreoReview } from '@/lib/perreo'
import { NO_FILTERS, type PerreoFilters } from '@/lib/perreo-types'

/** Explorador de artistas (los 66 y los de Instagram): galería con filtros combinables y orden. */
export function PerreoArtistsPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<PerreoFilters>(NO_FILTERS)
  const deferred = useDeferredValue(filters)
  const artists = usePerreoArtists(deferred)
  const pending = usePerreoReview().data?.pending.length ?? 0
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-5 md:px-10 md:py-8">
      <div className="flex flex-col gap-1">
        <Heading>Artistas</Heading>
        <Text tone="muted">Filtra por fama, país, época, sello o estilo y abre la ficha de cada uno.</Text>
        {pending > 0 && (
          <Link to="/perreo/por-revisar" className="inline-flex min-h-11 items-center font-bold text-domain underline">
            {pending} cuentas por revisar →
          </Link>
        )}
      </div>
      <ArtistExplorer
        filters={filters}
        onChange={setFilters}
        data={artists.data}
        loading={artists.isFetching}
        photoUrl={photoUrl}
        onOpen={(slug) => navigate(`/perreo/artistas/${slug}`)}
      />
    </div>
  )
}
