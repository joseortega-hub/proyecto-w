import { Link, useNavigate } from 'react-router'
import { Button, Cover, Heading, IconButton, Text } from '@/components/atoms'
import { Card } from '@/components/ui/card'
import { timeAgo } from '@/lib/format'
import { useSavedLists } from '@/lib/saved-lists'

export function HomePage() {
  const navigate = useNavigate()
  const { lists } = useSavedLists()
  const last = lists[0]

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 md:px-10">
      <section className="flex flex-1 flex-col justify-center gap-[18px] py-8">
        <Heading size="display">Dime cómo estás y te pongo lo que encaja.</Heading>
        <Text tone="muted" size="lead">
          Unas pocas preguntas de sí o no. Sin formularios ni registro.
        </Text>
        <Button block className="mt-2" onClick={() => navigate('/entrevista')}>
          Empezar
        </Button>
        <Button block variant="secondary" onClick={() => navigate('/biblioteca')}>
          Explorar la biblioteca
        </Button>
      </section>
      {last && (
        <Card className="mb-4 gap-2 rounded-[14px] px-3.5 py-3 shadow-none">
          <Text font="label">Tu última lista</Text>
          <div className="flex items-center gap-3">
            <Cover src={last.cover} alt="" className="size-12 flex-none rounded-[8px]" />
            <Link to={`/resultado/${last.id}`} className="flex min-w-0 flex-1 flex-col">
              <strong className="truncate text-[15px]">{last.title}</strong>
              <span className="text-[13px] text-muted-foreground">
                {last.count} canciones · {timeAgo(last.savedAt)}
              </span>
            </Link>
            <IconButton icon="play" label="Abrir la lista" variant="accent" onClick={() => navigate(`/resultado/${last.id}`)} />
          </div>
        </Card>
      )}
    </div>
  )
}
