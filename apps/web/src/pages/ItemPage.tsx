import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import { Button, IconButton, Skeleton } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { ItemDetail } from '@/components/organisms'
import { api } from '@/lib/api'
import { useDomain } from '@/lib/domain'
import { itemEntity, useEntityLinks } from '@/lib/links'
import { usePlayer } from '@/player/player-context'

/** /:domain/biblioteca/:itemId: la ficha, con los parecidos por embedding. */
export function ItemPage() {
  const { itemId = '' } = useParams()
  const navigate = useNavigate()
  const domain = useDomain()
  const player = usePlayer()
  const item = useQuery({ queryKey: ['item', itemId], queryFn: () => api.getItem(itemId) })
  // En música los créditos se piden a MusicBrainz al abrir la ficha (la API los guarda en caché).
  const details = useQuery({
    queryKey: ['details', itemId],
    queryFn: () => api.getDetails(itemId),
    enabled: item.data?.domainId === 'music' || item.data?.domainId === 'youtube',
    staleTime: Infinity,
  })
  const similar = useQuery({ queryKey: ['similar', itemId], queryFn: () => api.getSimilar(itemId, 6) })
  const linksName = item.data ? itemEntity(item.data, details.data) : null
  const links = useEntityLinks(domain.id, linksName)

  const back = (
    <IconButton icon="back" label="Volver" onClick={() => (history.length > 1 ? navigate(-1) : navigate(domain.path('biblioteca')))} />
  )
  if (item.isError) {
    return (
      <EmptyState
        icon="retry"
        title="No encuentro esta ficha"
        description={item.error.message}
        action={<Button onClick={() => navigate(domain.path('biblioteca'))}>Ir a la biblioteca</Button>}
      />
    )
  }

  const data = item.data
  const isCurrent = !!data && player.current?.item.id === data.id
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-5 md:px-10 md:py-8">
      <header>{back}</header>
      {!data || !domain.info ? (
        <div className="flex flex-col gap-4 md:flex-row" aria-busy>
          <Skeleton className="aspect-square w-full max-w-72 rounded-[14px]" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      ) : (
        <ItemDetail
          item={data}
          domain={domain.info}
          attributes={domain.info.attributes}
          details={details.data}
          similar={similar.data?.items}
          links={links.data}
          linksLoading={links.isLoading}
          linksName={linksName}
          playing={isCurrent && player.playing}
          onPlay={() =>
            isCurrent ? player.toggle() : player.playList([{ item: data, reason: '', match: 0 }], { title: data.title, id: `item:${data.id}`, domainId: domain.id })
          }
          onOpenSimilar={(other) => navigate(domain.path(`biblioteca/${other.id}`))}
        />
      )}
    </div>
  )
}
