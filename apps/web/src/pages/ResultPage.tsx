import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button, Chip, Heading, Icon, IconButton, Skeleton, Text } from '@/components/atoms'
import { EmptyState, RefineChips, SourceAttribution } from '@/components/molecules'
import { MoodProfile, ResultList } from '@/components/organisms'
import { ApiError, api } from '@/lib/api'
import { totalMinutes } from '@/lib/format'
import { agree, useDomain } from '@/lib/domain'
import { rememberSession } from '@/lib/ops'
import { useSavedLists } from '@/lib/saved-lists'
import { useFeedback, useTaste } from '@/lib/taste'
import { useSaveToYouTube } from '@/lib/youtube'
import { usePlayer } from '@/player/player-context'
import { TuningPage } from './TuningPage'

/** /:domain/resultado/:id. Sin lista todavía (o con ?afinar=…) muestra Afinando. */
export function ResultPage() {
  const { id = '' } = useParams()
  useEffect(() => rememberSession(id), [id])
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const player = usePlayer()
  const domain = useDomain()
  const { save, isSaved } = useSavedLists(domain.id)
  const taste = useTaste(domain.id)
  const feedback = useFeedback(domain.id)
  const saveToYouTube = useSaveToYouTube(id)
  const { prepareVideo } = player

  // En "Mi YouTube" se carga ya el reproductor de YouTube: así el primer toque suena también en móvil.
  useEffect(() => {
    if (domain.id === 'youtube') prepareVideo()
  }, [domain.id, prepareVideo])

  const refineParam = params.get('afinar')
  const tuning = refineParam !== null
  const refine = refineParam ? refineParam.split(',').filter(Boolean) : []

  const result = useQuery({
    queryKey: ['result', id],
    queryFn: () => api.getResult(id),
    enabled: !tuning,
    retry: (count, e) => !(e instanceof ApiError && e.status === 400) && count < 2,
  })

  const notReady = result.error instanceof ApiError && result.error.status === 400
  if (tuning || notReady) {
    const attributes = result.data?.attributes ?? domain.info?.attributes ?? []
    return (
      <TuningPage
        sessionId={id}
        domainId={domain.id}
        refine={refine}
        attributes={attributes}
        onDone={async () => {
          await queryClient.invalidateQueries({ queryKey: ['result', id] })
          setParams({}, { replace: true })
        }}
      />
    )
  }

  if (result.isError) {
    return <EmptyState icon="retry" title="No encuentro esta lista" description={result.error.message} action={<Button onClick={() => navigate(domain.path())}>Volver al inicio</Button>} />
  }

  const data = result.data
  if (!data) {
    return (
      <div className="flex flex-col gap-4 px-5 py-5" aria-busy>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-13 w-full" />
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    )
  }

  const minutes = totalMinutes(data.entries.map((e) => e.item.durationSec))
  const queue = data.entries.map((e) => ({ item: e.item, reason: e.reason, match: e.match }))
  const playingThisList = player.listId === data.id
  const play = (start = 0) => {
    if (playingThisList && player.index === start) return player.toggle()
    player.playList(queue, { title: data.title, id: data.id, domainId: data.domainId, start })
  }
  const saved = isSaved(data.id)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-5 md:px-10 lg:flex-row md:py-8">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <header className="flex items-center justify-between">
          <IconButton icon="back" label="Volver al inicio" onClick={() => navigate(domain.path())} />
          <Button variant="ghost" size="md" onClick={() => navigate(domain.path('entrevista'))}>
            Nueva entrevista
          </Button>
        </header>
        <div className="flex flex-col gap-0.5">
          <Text font="label">Tu lista</Text>
          <Heading>{data.title}</Heading>
          <Text tone="muted" size="sm">
            {data.entries.length} {domain.nounPlural}
            {minutes > 0 && (domain.playable ? ` · ${minutes} min` : ` · ${Math.round(minutes / 60)} h en total`)} · a partir de {data.answeredCount} respuestas
          </Text>
          {!!data.likedCount && (
            <Text size="sm" role="status">
              ❤️ {data.likedCount} de {data.entries.length} van con tus gustos
            </Text>
          )}
          {data.notice && (
            <Text size="sm" role="status">
              {data.notice}
            </Text>
          )}
        </div>
        <div className="flex gap-2.5">
          {domain.playable && (
            <Button className="flex-1" onClick={() => play(playingThisList ? player.index : 0)}>
              <Icon name={playingThisList && player.playing ? 'pause' : 'play'} />
              {playingThisList && player.playing ? 'Pausar' : 'Reproducir'}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              save(data)
              toast.success('Lista guardada en este dispositivo')
            }}
            disabled={saved}
            className={domain.playable ? undefined : 'flex-1'}
          >
            <Icon name={saved ? 'bookmarked' : 'bookmark'} />
            {saved ? 'Guardada' : 'Guardar'}
          </Button>
        </div>
        {domain.id === 'youtube' &&
          (data.youtube ? (
            <Button variant="secondary" block asChild>
              <a href={data.youtube.url} target="_blank" rel="noreferrer">
                <Icon name="youtube" className="text-domain" /> Abrir en mi YouTube
              </a>
            </Button>
          ) : (
            <Button
              variant="secondary"
              block
              disabled={saveToYouTube.isPending}
              onClick={() =>
                saveToYouTube.mutate(undefined, {
                  onSuccess: (r) =>
                    toast.success('Lista creada en tu YouTube (privada)', {
                      description: r.failed ? `${r.failed} canciones no se han podido añadir.` : undefined,
                      action: { label: 'Abrir', onClick: () => window.open(r.url, '_blank', 'noopener') },
                    }),
                  onError: (e) =>
                    toast.error(e instanceof ApiError && e.code === 'youtube_reconnect' ? 'Vuelve a conectar tu YouTube' : 'No he podido crear la lista', {
                      description: e.message,
                      action:
                        e instanceof ApiError && e.code === 'youtube_reconnect'
                          ? { label: 'Conectar', onClick: () => navigate(domain.path()) }
                          : undefined,
                    }),
                })
              }
            >
              <Icon name="listPlus" className="text-domain" />
              {saveToYouTube.isPending ? 'Creando la lista…' : 'Guardar en mi YouTube'}
            </Button>
          ))}
        <ResultList
          entries={data.entries}
          currentId={playingThisList ? player.current?.item.id : null}
          playing={player.playing}
          opensDetail={!domain.playable}
          // Sin reproductor (películas, libros, videojuegos), el toque abre la ficha con el enlace a la fuente.
          onSelect={domain.playable ? play : (i) => navigate(domain.path(`biblioteca/${data.entries[i].item.id}`))}
          feedback={taste.data?.feedback}
          onFeedback={(itemId, value) =>
            feedback.mutate(
              { itemId, value },
              {
                onSuccess: () => value && toast.success(value === 'up' ? 'Apuntado: más como este' : 'Apuntado: menos como este', { duration: 1800 }),
                onError: (e) => toast.error('No he podido guardarlo', { description: e.message }),
              },
            )
          }
        />
        <RefineChips
          options={data.refinements}
          value={data.appliedRefinements}
          onChange={(value) => setParams({ afinar: value.join(',') })}
        />
      </div>
      <aside className="flex flex-col gap-3 lg:w-80 lg:flex-none">
        <MoodProfile attributes={data.attributes} scales={data.profile.scales} />
        <div className="flex flex-wrap gap-1.5" aria-label="Tus respuestas">
          {data.chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
        <Text tone="muted" size="xs" font="mono">
          {data.candidates} {agree(domain.info, 'candidatas', 'candidatos')} entre {data.catalogSize} · {agree(domain.info, 'elegidas y explicadas', 'elegidos y explicados')} con IA
        </Text>
        {domain.info && <SourceAttribution {...domain.info.source} />}
      </aside>
    </div>
  )
}
