import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button, Heading, Skeleton, Text } from '@/components/atoms'
import { EmptyState, YearStoryCard } from '@/components/molecules'
import { YearStories } from '@/components/organisms'
import { GlobalShell } from '@/components/templates/GlobalShell'
import { api, type YearCardKind, type YearView } from '@/lib/api'
import { cardAlt, shareImage, useYear, useYearCard } from '@/lib/year'

/** /tu-ano: «Tu año en Sintonía», tarjetas tipo historia para pasar y compartir. */
export function YearPage() {
  const navigate = useNavigate()
  const year = useYear()
  const [sharing, setSharing] = useState<YearCardKind | null>(null)

  const share = async (kind: YearCardKind, headline: string) => {
    setSharing(kind)
    try {
      const blob = await api.getYearCard(kind)
      if ((await shareImage(blob, `mi-ano-en-sintonia-${kind}.png`, headline)) === 'downloaded') toast.success('Imagen descargada: ya puedes compartirla')
    } catch (e) {
      toast.error('No he podido preparar la imagen', { description: (e as Error).message })
    } finally {
      setSharing(null)
    }
  }

  return (
    <GlobalShell>
      <div className="flex flex-col gap-1">
        <Heading size="display">Tu año en Sintonía</Heading>
        <Text tone="muted" size="lead">
          {year.data ? `Tu ${year.data.summary.year} con lo que has pedido, valorado y marcado.` : 'Lo que has pedido, valorado y marcado este año.'} Desliza para ver cada tarjeta.
        </Text>
      </div>
      {year.isError ? (
        <EmptyState icon="retry" title="No puedo preparar tu año" description={year.error.message} action={<Button onClick={() => year.refetch()}>Reintentar</Button>} />
      ) : year.isPending ? (
        <Skeleton className="mx-auto mt-6 aspect-[9/16] h-[min(68dvh,760px)] rounded-[22px]" aria-busy />
      ) : !year.data.cards.length ? (
        <EmptyState
          icon="calendar"
          title="Todavía no hay año que contar"
          description="Haz alguna entrevista y marca lo que ya has visto: tu resumen se irá llenando."
          action={<Button onClick={() => navigate('/')}>Crear mi primera lista</Button>}
        />
      ) : (
        <YearStories
          className="mt-6"
          count={year.data.cards.length}
          renderCard={(i, near) => <Card key={year.data.cards[i].kind} view={year.data} index={i} near={near} sharing={sharing} onShare={share} />}
        />
      )}
    </GlobalShell>
  )
}

function Card({ view, index, near, sharing, onShare }: { view: YearView; index: number; near: boolean; sharing: YearCardKind | null; onShare: (kind: YearCardKind, headline: string) => void }) {
  const { kind, headline } = view.cards[index]
  const image = useYearCard(kind, near)
  return (
    <YearStoryCard
      src={image.data}
      alt={cardAlt(kind, view.summary, headline)}
      position={`${index + 1} de ${view.cards.length}`}
      sharing={sharing === kind}
      onShare={() => onShare(kind, headline)}
    />
  )
}
