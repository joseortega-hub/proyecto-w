import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button, Heading, IconButton, Skeleton, Text } from '@/components/atoms'
import { EmptyState, ItemRow, SeenControl } from '@/components/molecules'
import type { SeenRating } from '@/lib/api'
import { geekLine } from '@/lib/details'
import { useDomain } from '@/lib/domain'
import { hasSeen, RATINGS, seenWords, useSeen, useSeenMutation } from '@/lib/seen'
import { cn } from '@/lib/utils'

type Filter = SeenRating | 'all'

/** /:domain/ya-visto: lo ya visto, leído, jugado o escuchado de la temática, para consultarlo y desmarcar. */
export function SeenPage() {
  const domain = useDomain()
  const navigate = useNavigate()
  const words = seenWords(domain.id)
  const list = useSeen(domain.id)
  const mutation = useSeenMutation(domain.id)
  const [filter, setFilter] = useState<Filter>('all')

  if (!hasSeen(domain.id)) {
    return <EmptyState icon="info" title="Esta temática no lo necesita" description="Aquí ya está solo lo tuyo." action={<Button onClick={() => navigate(domain.path())}>Volver al inicio</Button>} />
  }
  if (list.isError) {
    return <EmptyState icon="retry" title="No puedo cargarlo" description={list.error.message} action={<Button onClick={() => list.refetch()}>Reintentar</Button>} />
  }

  const entries = list.data?.entries ?? []
  const shown = filter === 'all' ? entries : entries.filter((e) => e.rating === filter)
  const count = (f: Filter) => (f === 'all' ? entries.length : entries.filter((e) => e.rating === f).length)
  const filters: { value: Filter; label: string }[] = [{ value: 'all', label: 'Todo' }, ...RATINGS.map((r) => ({ value: r.value, label: `${r.emoji} ${r.label}` }))]

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 py-6 md:px-10 md:py-8">
      <header className="flex flex-col gap-1.5">
        <IconButton icon="back" label="Volver" onClick={() => (history.length > 1 ? navigate(-1) : navigate(domain.path('gustos')))} />
        <Text font="label" className="text-domain">
          {domain.info?.name ?? ''} · {words.section}
        </Text>
        <Heading>{words.section}</Heading>
        <Text tone="muted">
          Lo que marques aquí no volverá a salir en tus listas. Tu valoración nos ayuda a acertar más: «Me encantó» cuenta más que un 👍 y «Meh», un poco menos.
        </Text>
      </header>

      {!list.data ? (
        <div className="flex flex-col gap-2" aria-busy>
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : !entries.length ? (
        <EmptyState
          icon="eye"
          title={`Todavía no hay ${domain.nounPlural} aquí`}
          description={`Pulsa «${words.mark}» en una ficha, en tu lista o en «Desliza».`}
          action={<Button onClick={() => navigate(domain.path('biblioteca'))}>Ir a la biblioteca</Button>}
        />
      ) : (
        <>
          <div role="group" aria-label="Filtrar por valoración" className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'min-h-9 touch:min-h-11 rounded-full px-3 text-[13px] font-bold transition-colors duration-200',
                  filter === f.value ? 'bg-accent text-accent-foreground' : 'border-[1.5px] border-border bg-card hover:bg-secondary',
                )}
              >
                {f.label} · {count(f.value)}
              </button>
            ))}
          </div>
          <ol className="flex flex-col gap-1.5">
            {shown.map((e) => (
              <li key={e.item.id}>
                <ItemRow
                  title={e.item.title}
                  subtitle={e.item.subtitle}
                  imageUrl={e.item.imageUrl}
                  detail={geekLine(e.item.domainId, e.item.details)}
                  onSelect={() => navigate(domain.path(`biblioteca/${e.item.id}`))}
                  actionLabel="Ver la ficha de"
                  className="rounded-[14px] px-3 py-2"
                >
                  <SeenControl
                    title={e.item.title}
                    words={words}
                    rating={e.rating}
                    onChange={(n) =>
                      mutation.mutate(
                        { item: e.item, ...n },
                        {
                          onSuccess: () =>
                            !n.seen &&
                            toast(`Quitado: ${e.item.title}`, { duration: 5000, action: { label: 'Deshacer', onClick: () => mutation.mutate({ item: e.item, seen: true, rating: e.rating }) } }),
                          onError: (err) => toast.error('No he podido guardarlo', { description: err.message }),
                        },
                      )
                    }
                  />
                </ItemRow>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
