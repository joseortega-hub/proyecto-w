import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Button, Heading, Icon, Skeleton, Text } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { AiPanel, LearnedPanel, TopPanel, VibeCalendar, type RecentVibe } from '@/components/organisms'
import { GlobalShell } from '@/components/templates/GlobalShell'
import { domainIcon, useDomains } from '@/lib/domain'
import { buildCalendar, currentStreak, useStory } from '@/lib/story'

const WEEKS = 16
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })

/** "/historia": «Tu historia». Calendario de vibras, tu top, lo aprendido y la IA en números. */
export function StoryPage() {
  const navigate = useNavigate()
  const story = useStory()
  const domains = useDomains()
  const nameOf = (id: string) => domains.data?.find((d) => d.id === id)?.name ?? id

  const cells = useMemo(() => buildCalendar(story.data?.days ?? [], new Date(), WEEKS), [story.data])
  const recent: RecentVibe[] = cells
    .filter((c) => c.day)
    .reverse()
    .slice(0, 5)
    .map((c) => ({
      id: c.day!.id,
      domainId: c.day!.domainId,
      domainName: nameOf(c.day!.domainId),
      icon: domainIcon(c.day!.domainId),
      dateLabel: dateLabel(c.day!.at),
      emoji: c.day!.emoji,
      text: c.day!.text,
      gradient: c.day!.gradient,
      onOpen: () => navigate(`/${c.day!.domainId}/resultado/${c.day!.id}`),
    }))

  return (
    <GlobalShell>
      <div className="flex flex-col gap-1">
        <Heading size="display">Tu historia</Heading>
        <Text tone="muted" size="lead">
          Lo que Sintonía ha aprendido de ti. Solo vive en tu navegador anónimo: nadie más lo ve.
        </Text>
        <Button variant="secondary" size="md" className="mt-2 self-start" onClick={() => navigate('/tu-ano')}>
          <Icon name="sparkles" /> Tu año en Sintonía
        </Button>
      </div>
      {story.isError ? (
        <EmptyState icon="retry" title="No puedo cargar tu historia" description={story.error.message} action={<Button onClick={() => story.refetch()}>Reintentar</Button>} />
      ) : story.isPending ? (
        <div className="flex flex-col gap-4" aria-busy>
          <Skeleton className="h-56 w-full rounded-[22px]" />
          <Skeleton className="h-40 w-full rounded-[22px]" />
        </div>
      ) : story.data.lists === 0 && story.data.learned.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Tu historia empieza con la primera lista"
          description="Haz una entrevista de unas pocas preguntas y aquí aparecerán tu vibra de cada día, tus favoritos y lo que voy aprendiendo de ti."
          action={<Button onClick={() => navigate('/')}>Crear mi primera lista</Button>}
        />
      ) : (
        <>
          <VibeCalendar cells={cells} weeks={WEEKS} streak={currentStreak(cells)} recent={recent} />
          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <TopPanel top={story.data.top.map((t) => ({ ...t, icon: domainIcon(t.domainId) }))} tasteFit={story.data.tasteFit} />
            <LearnedPanel learned={story.data.learned.map((l) => ({ ...l, icon: domainIcon(l.domainId) }))} />
          </div>
          <AiPanel ai={story.data.ai} />
        </>
      )}
    </GlobalShell>
  )
}
