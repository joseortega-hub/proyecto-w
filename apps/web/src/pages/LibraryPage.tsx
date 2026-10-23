import { useInfiniteQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Heading, SearchField, Skeleton, Text } from '@/components/atoms'
import { EmptyState, RefineChips, SourceAttribution } from '@/components/molecules'
import { ItemGrid } from '@/components/organisms'
import { api } from '@/lib/api'
import { useDomain } from '@/lib/domain'
import { formatInt } from '@/lib/format'

const PAGE = 30

/** Biblioteca de la temática: búsqueda, filtro por grupos de géneros y acceso a cada ficha. */
export function LibraryPage() {
  const navigate = useNavigate()
  const domain = useDomain()
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const q = useDeferredValue(query.trim())
  const tagGroups = domain.info?.tagGroups ?? []
  const tags = tagGroups.filter((g) => groups.includes(g.key)).flatMap((g) => g.tags)

  const pages = useInfiniteQuery({
    queryKey: ['library', domain.id, q, tags],
    queryFn: ({ pageParam }) => api.browse(domain.id, { q, tags, offset: pageParam, limit: PAGE }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0)
      return loaded < last.total ? loaded : undefined
    },
  })
  const items = pages.data?.pages.flatMap((p) => p.items) ?? []
  const total = pages.data?.pages[0]?.total

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-5 md:px-10 md:py-8">
      <div className="flex flex-col gap-1">
        <Heading>Biblioteca</Heading>
        <Text tone="muted" size="sm">
          {total === undefined ? '…' : `${formatInt(total)} ${domain.nounPlural}`}
          {domain.info && ` · catálogo de ${domain.info.source.name}`}
        </Text>
      </div>
      <SearchField
        label={`Buscar ${domain.nounPlural} por título o ${domain.info?.creatorLabel ?? 'autor'}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {tagGroups.length > 0 && (
        <RefineChips label="Géneros" options={tagGroups} value={groups} onChange={setGroups} />
      )}
      {pages.isError ? (
        <EmptyState icon="retry" title="No puedo cargar la biblioteca" description={pages.error.message} />
      ) : pages.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-busy>
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-[10px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon="search" title="No encuentro nada" description="Prueba con otra búsqueda o quita algún filtro." />
      ) : (
        <ItemGrid items={items} onSelect={(item) => navigate(domain.path(`biblioteca/${item.id}`))} />
      )}
      {pages.hasNextPage && (
        <Button variant="secondary" size="md" className="self-center" disabled={pages.isFetchingNextPage} onClick={() => pages.fetchNextPage()}>
          {pages.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
        </Button>
      )}
      {domain.info && <SourceAttribution {...domain.info.source} className="pt-2" />}
    </div>
  )
}
