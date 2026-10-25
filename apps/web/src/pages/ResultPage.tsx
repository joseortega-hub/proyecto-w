import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button, Chip, Heading, Icon, IconButton, Skeleton, Text } from '@/components/atoms'
import { EmptyState, LayoutSwitch, LearnMore, SourceAttribution } from '@/components/molecules'
import { AddTracksPanel, ResultList, SwipeDeck, VibeCard } from '@/components/organisms'
import { ApiError, api, type Item, type ResultEntry, type SessionResult } from '@/lib/api'
import { geekLine } from '@/lib/details'
import { totalMinutes } from '@/lib/format'
import { agree, useDomain } from '@/lib/domain'
import { rememberSession } from '@/lib/ops'
import { useSavedLists } from '@/lib/saved-lists'
import { useSessionLinks } from '@/lib/links'
import { loadLayout, saveLayout, type ResultLayout } from '@/lib/swipe'
import { useFeedback, useTaste } from '@/lib/taste'
import { useSwipeSession } from '@/lib/use-swipe'
import { youtubeQuotaWarning } from '@/lib/list-size'
import { useSaveToYouTube } from '@/lib/youtube'
import { vibeGradient } from '@/lib/vibe/vibe-color'
import { renderVibeCard, shareVibeImage } from '@/lib/vibe/vibe-share'
import { vibeSpec } from '@/lib/vibe/vibe-spec'
import { vibeTitle } from '@/lib/vibe/vibe-title'
import { levelWord } from '@/lib/vibe/vibe-words'
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
  const { save, sync, isSaved } = useSavedLists(domain.id)
  const taste = useTaste(domain.id)
  const feedback = useFeedback(domain.id)
  const saveToYouTube = useSaveToYouTube(id)
  const { prepareVideo } = player

  // En "Mi YouTube" se carga ya el reproductor de YouTube: así el primer toque suena también en móvil.
  useEffect(() => {
    if (domain.id === 'youtube') prepareVideo()
  }, [domain.id, prepareVideo])

  const [sharing, setSharing] = useState(false)

  const refineParam = params.get('afinar')
  const tuning = refineParam !== null
  const refine = refineParam ? refineParam.split(',').filter(Boolean) : []

  const result = useQuery({
    queryKey: ['result', id],
    queryFn: () => api.getResult(id),
    enabled: !tuning,
    retry: (count, e) => !(e instanceof ApiError && e.status === 400) && count < 2,
  })
  // "Para saber más": si la lista gira en torno a algo concreto ("Marvel"), sus mejores webs.
  const learnMore = useSessionLinks(id, result.data?.anchors)

  // Tu vibra: soltar una barra reordena la lista dentro de la bolsa, sin entrevista ni IA.
  const revibe = useMutation({
    mutationFn: (scales?: Record<string, number>) => api.revibe(id, scales),
    onSuccess: (next, scales) => {
      const before = new Set(result.data?.entries.map((e) => e.item.id))
      const fresh = next.entries.filter((e) => !before.has(e.item.id)).length
      queryClient.setQueryData(['result', id], next)
      toast.success(scales ? (fresh ? `Lista reordenada: ${fresh} nuevas` : 'Lista reordenada') : 'Vuelves a la lista original', { duration: 2200 })
    },
    onError: (e: Error) => toast.error('No he podido reordenar la lista', { description: e.message }),
  })

  // Editar la lista: el cambio se ve al momento y se guarda en la API tras medio segundo sin tocar nada.
  const [editing, setEditing] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const flushEntries = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = undefined
    const current = queryClient.getQueryData<SessionResult>(['result', id])
    if (!current?.entries.length) return
    api.saveEntries(id, current.entries.map((e) => e.item.id)).catch((e: Error) => {
      toast.error('No he podido guardar los cambios de la lista', { description: e.message })
      void queryClient.invalidateQueries({ queryKey: ['result', id] })
    })
  }, [id, queryClient])
  useEffect(() => () => { if (saveTimer.current) flushEntries() }, [flushEntries])
  const updateEntries = useCallback(
    (entries: ResultEntry[]) => {
      const current = queryClient.getQueryData<SessionResult>(['result', id])
      if (!current) return
      const next = { ...current, entries }
      queryClient.setQueryData(['result', id], next)
      sync(next)
      if (player.listId === id) player.syncQueue(entries.map((e) => ({ item: e.item, reason: e.reason, match: e.match })))
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(flushEntries, 500)
    },
    [id, queryClient, sync, player, flushEntries],
  )
  const moveEntry = (from: number, to: number) => {
    const list = [...(queryClient.getQueryData<SessionResult>(['result', id])?.entries ?? [])]
    if (!list[from] || to < 0 || to >= list.length) return
    list.splice(to, 0, list.splice(from, 1)[0])
    updateEntries(list)
  }
  const removeEntry = (index: number) => {
    const before = queryClient.getQueryData<SessionResult>(['result', id])?.entries ?? []
    if (before.length <= 1) return void toast.info('La lista no puede quedarse vacía')
    updateEntries(before.filter((_, i) => i !== index))
    toast(`Quitada: ${before[index].item.title}`, { duration: 5000, action: { label: 'Deshacer', onClick: () => updateEntries(before) } })
  }
  const addEntry = (item: Item) => {
    const before = queryClient.getQueryData<SessionResult>(['result', id])?.entries ?? []
    if (before.some((e) => e.item.id === item.id)) return
    updateEntries([...before, { item, match: 0, fit: null, reason: '' }])
    toast.success(`Añadida al final: ${item.title}`, { duration: 2200 })
  }

  // «Desliza»: una tarjeta cada vez; el navegador recuerda si se prefiere así o en lista.
  const [layout, setLayoutState] = useState<ResultLayout>(loadLayout)
  const setLayout = (next: ResultLayout) => {
    setLayoutState(next)
    saveLayout(next)
    if (next === 'swipe') setEditing(false)
  }
  const swipe = useSwipeSession({
    sessionId: id,
    entries: result.data?.entries ?? [],
    feedback: taste.data?.feedback ?? {},
    sendFeedback: (itemId, value) => feedback.mutate({ itemId, value }, { onError: (e) => toast.error('No he podido guardarlo', { description: e.message }) }),
    updateEntries,
    enabled: layout === 'swipe' && !!result.data,
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

  const shareVibe = async () => {
    setSharing(true)
    try {
      const spec = vibeSpec(domain.id)
      const scales = data.profile.scales
      const title = vibeTitle(domain.id, scales, data.vibe.context)
      const blob = await renderVibeCard({
        title,
        gradient: vibeGradient(scales[spec.axes.drive] ?? 0.5, scales[spec.axes.mood] ?? 0.5),
        bars: data.attributes.map((a) => ({ label: a.label, value: scales[a.key] ?? 0.5, word: levelWord(scales[a.key] ?? 0.5, a) })),
        top: data.entries.slice(0, 3).map((e) => e.item.title),
        brand: 'Sintonía',
        listTitle: data.title,
      })
      if ((await shareVibeImage(blob, title.text)) === 'downloaded') toast.success('Imagen descargada: ya puedes compartirla')
    } catch (e) {
      toast.error('No he podido crear la imagen', { description: (e as Error).message })
    } finally {
      setSharing(false)
    }
  }
  // En móvil va encima de la lista (para ver cómo se reordena); en escritorio, en el lateral.
  const vibeCard = (
    <VibeCard
      domainId={domain.id}
      attributes={data.attributes}
      scales={data.profile.scales}
      sources={data.vibe.sources}
      confidence={data.profile.confidence}
      context={data.vibe.context}
      adjusted={data.vibe.adjusted}
      pending={revibe.isPending}
      sharing={sharing}
      onCommit={(moved) => revibe.mutate(moved)}
      onReset={() => revibe.mutate(undefined)}
      onShare={shareVibe}
    />
  )

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
          {layout === 'list' && <IconButton icon={editing ? 'check' : 'edit'} variant={editing ? 'primary' : 'subtle'} label={editing ? 'Terminar de editar la lista' : 'Editar la lista'} aria-pressed={editing} onClick={() => setEditing((v) => !v)} />}
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
              onClick={() => {
                const warning = youtubeQuotaWarning(data.entries.length)
                if (warning && !window.confirm(warning)) return
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
              }}
            >
              <Icon name="listPlus" className="text-domain" />
              {saveToYouTube.isPending ? 'Creando la lista…' : 'Guardar en mi YouTube'}
            </Button>
          ))}
        {editing && (
          <>
            <Text size="sm" tone="muted">
              Arrastra el asa ⠿ (en el móvil, mantén pulsado) o usa ↑ ↓ para ordenar. Los cambios se guardan solos.
            </Text>
            {data.youtube && (
              <Text size="sm" role="status">
                Esta lista ya está en tu YouTube y allí no se actualiza: los cambios se quedan en Sintonía.
              </Text>
            )}
            <AddTracksPanel domainId={domain.id} noun={domain.nounPlural} existingIds={new Set(data.entries.map((e) => e.item.id))} onAdd={addEntry} />
          </>
        )}
        <LayoutSwitch value={layout} onChange={setLayout} />
        {layout === 'swipe' ? (
          <SwipeDeck
            cards={swipe.cards}
            loading={swipe.loading}
            lastVerdict={swipe.lastVerdict}
            onUndo={swipe.canUndo ? swipe.undo : undefined}
            inList={(itemId) => data.entries.some((e) => e.item.id === itemId)}
            detail={(e) => geekLine(e.item.domainId, e.item.details)}
            onGesture={(gesture, entry) =>
              gesture === 'detail' ? navigate(domain.path(`biblioteca/${entry.item.id}`)) : swipe.decide(gesture, entry)
            }
            actions={(entry) => {
              if (domain.playable) {
                const on = player.current?.item.id === entry.item.id
                const index = data.entries.findIndex((e) => e.item.id === entry.item.id)
                return (
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() =>
                      on ? player.toggle() : index >= 0 ? play(index) : player.playList([{ item: entry.item, reason: entry.reason, match: entry.match }], { title: data.title, id: `${data.id}:desliza`, domainId: data.domainId })
                    }
                  >
                    <Icon name={on && player.playing ? 'pause' : 'play'} />
                    {on && player.playing ? 'Pausar' : 'Escuchar'}
                  </Button>
                )
              }
              return entry.item.externalUrl ? (
                <Button variant="secondary" className="flex-1" asChild>
                  <a href={entry.item.externalUrl} target="_blank" rel="noreferrer">
                    <Icon name="external" /> Ver en {domain.info?.source.name ?? 'la fuente'}
                  </a>
                </Button>
              ) : null
            }}
            empty={
              <EmptyState
                icon="check"
                title="Ya lo has visto todo"
                description={`Tu lista se queda con ${data.entries.length} ${domain.nounPlural}. Puedes verla entera o repasarla otra vez.`}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => setLayout('list')}>Ver la lista</Button>
                    <Button variant="secondary" onClick={swipe.restart}>
                      Repasar otra vez
                    </Button>
                  </div>
                }
              />
            }
          />
        ) : (
          <>
        <div className="lg:hidden">{vibeCard}</div>
        <ResultList
          entries={data.entries}
          currentId={playingThisList ? player.current?.item.id : null}
          playing={player.playing}
          opensDetail={!domain.playable}
          edit={editing ? { onMove: moveEntry, onRemove: removeEntry } : undefined}
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
          </>
        )}
      </div>
      <aside className="flex flex-col gap-3 lg:w-80 lg:flex-none">
        <div className="hidden lg:block">{vibeCard}</div>
        <div className="flex flex-wrap gap-1.5" aria-label="Tus respuestas">
          {data.chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
        <Text tone="muted" size="xs" font="mono">
          {data.candidates} {agree(domain.info, 'candidatas', 'candidatos')} entre {data.catalogSize} · {agree(domain.info, 'elegidas y explicadas', 'elegidos y explicados')} con IA
        </Text>
        {learnMore.data && <LearnMore links={learnMore.data} className="mt-2" />}
        {domain.info && <SourceAttribution {...domain.info.source} />}
      </aside>
    </div>
  )
}
