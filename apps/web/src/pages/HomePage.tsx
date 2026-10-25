import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button, Cover, DomainIcon, Heading, Icon, IconButton, Text } from '@/components/atoms'
import { ListSizeField, PreferencePicker, StartingPointField } from '@/components/molecules'
import { useListSize } from '@/lib/list-size'
import { FolderPanel, YouTubePanel } from '@/components/organisms'
import { Card } from '@/components/ui/card'
import { useDomain } from '@/lib/domain'
import { analyzeAudio, chooseFolder, importFolder, stopAudio, reconnectFolder, restoreFolder, useFolderState, useFolderStatus, useForgetFolder } from '@/lib/folder'
import { allLocalFiles, canRememberFolder, songsOnlyDevice } from '@/lib/local-files'
import { timeAgo } from '@/lib/format'
import { usePreferences } from '@/lib/preferences'
import { useSavedLists } from '@/lib/saved-lists'
import { useSaveTaste, useTaste } from '@/lib/taste'
import { useConnectYouTube, useDisconnectYouTube, useImportYouTube, useYouTubeStatus } from '@/lib/youtube'

export function HomePage() {
  const navigate = useNavigate()
  const domain = useDomain()
  const [listSize, setListSize] = useListSize(domain.id)
  const { lists } = useSavedLists(domain.id)
  const last = lists[0]
  const preferences = domain.info?.preferences ?? []
  const { chosen, choose } = usePreferences(domain.id)
  const taste = useTaste(domain.id)
  const skipTaste = useSaveTaste(domain.id)
  const [text, setText] = useState('')
  const isYouTube = domain.id === 'youtube'
  const isFolder = domain.id === 'folder'
  const youtube = useYouTubeSection(isYouTube)
  const folder = useFolderSection(isFolder)
  // En los catálogos personales no hay entrevista posible hasta tener canciones importadas.
  const ready = !domain.personal || (isFolder ? (folder.status.data?.itemCount ?? 0) : (youtube.status.data?.itemCount ?? 0)) > 0

  // Las preferencias habituales guardadas con los gustos vienen marcadas en un dispositivo nuevo.
  useEffect(() => {
    for (const [key, value] of Object.entries(taste.data?.preferences ?? {})) if (!chosen[key]) choose(key, value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taste.data])

  // El texto viaja en el estado de la navegación, nunca en la URL ni en el dispositivo.
  // Las preferencias elegidas con los botones viajan con él: la entrevista las conoce desde la primera pregunta.
  const start = (initialText?: string) => navigate(domain.path('entrevista'), { state: { ...(initialText ? { initialText } : {}), preferences: chosen } })
  const liked = taste.data?.likes ?? []

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 md:px-10">
      <section className="flex flex-1 flex-col justify-center gap-[18px] py-8">
        {domain.info && (
          <div className="flex items-center gap-2.5">
            <DomainIcon icon={domain.icon} size="sm" />
            <Text font="label" className="text-domain">
              {domain.info.name}
            </Text>
          </div>
        )}
        <Heading size="display">Cuéntanos cómo te sientes y te recomendamos lo que mejor encaja.</Heading>
        <Text tone="muted" size="lead">
          Unas pocas preguntas de sí o no. Sin formularios ni registro.
        </Text>
        {isFolder && (
          <FolderPanel
            state={folder.state}
            itemCount={folder.status.data?.itemCount}
            review={folder.status.data?.review}
            pending={(folder.status.data?.unanalyzed ?? 0) + (folder.status.data?.unembedded ?? 0)}
            unmeasured={folder.status.data?.unmeasured}
            onAnalyzeAudio={folder.analyzeAudio}
            onStopAudio={stopAudio}
            canRemember={canRememberFolder()}
            songsMode={songsOnlyDevice()}
            onChoose={folder.choose}
            onReconnect={folder.reconnect}
            onImport={folder.importNew}
            onReview={() => navigate(domain.path('revisar'))}
            onForget={() => {
              if (!window.confirm('¿Olvidar la carpeta? Borro de Sintonía los datos de tus canciones (tus archivos no se tocan).')) return
              folder.forget.mutate(undefined, { onSuccess: () => toast.success('Carpeta olvidada y datos borrados de Sintonía') })
            }}
          />
        )}
        {isYouTube && (
          <YouTubePanel
            status={youtube.status.data}
            busy={youtube.busy}
            onConnect={() =>
              youtube.connect.mutate(undefined, { onError: (e) => toast.error('No he podido conectar con Google', { description: e.message }) })
            }
            onImport={() =>
              youtube.importNow.mutate(undefined, { onError: (e) => toast.error('No he podido actualizar tu música', { description: e.message }) })
            }
            onDisconnect={() => {
              if (!window.confirm('¿Desconectar YouTube? Borro de Sintonía tu música importada y retiro el permiso de Google.')) return
              youtube.disconnect.mutate(undefined, { onSuccess: () => toast.success('YouTube desconectado y tu música borrada de Sintonía') })
            }}
          />
        )}
        {ready && taste.data && !taste.data.onboarded && (
          <Card className="gap-3 rounded-[14px] border-domain/40 bg-domain-soft px-4 py-3.5 shadow-none">
            <div className="flex items-start gap-3">
              <Icon name="heart" className="mt-0.5 size-5 flex-none text-domain" />
              <div className="flex flex-col gap-0.5">
                <strong className="text-[15px]">Primera vez por aquí</strong>
                <Text size="sm" tone="muted">
                  Cuéntanos qué {domain.nounPlural} te gustan y las listas lo tendrán en cuenta. Solo te llevará medio minuto.
                </Text>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="md" className="flex-1" onClick={() => navigate(domain.path('gustos?bienvenida'))}>
                Contarte mis gustos
              </Button>
              <Button size="md" variant="ghost" disabled={skipTaste.isPending} onClick={() => skipTaste.mutate({ likes: [], dislikes: [] })}>
                Ahora no
              </Button>
            </div>
          </Card>
        )}
        {liked.length > 0 && (
          <Link to={domain.path('gustos')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Icon name="heart" className="size-4 flex-none fill-current text-domain" />
            <span className="truncate">Con tus gustos: {liked.map((l) => l.label).join(', ')}</span>
          </Link>
        )}
        {ready && (
          <>
            {preferences.map((p) => (
              <PreferencePicker key={p.key} preference={p} value={chosen[p.key]} onChange={(v) => choose(p.key, v)} />
            ))}
            <StartingPointField
              value={text}
              onChange={setText}
              label={`¿Cómo estás o qué te apetece ${domain.info?.verb ?? ''}?`.replace(' ?', '?')}
              placeholder="Ej.: vengo reventado del curro y quiero algo tranqui"
            />
            <ListSizeField value={listSize} onChange={setListSize} noun={domain.nounPlural} />
            <Button block className="mt-2" onClick={() => start(text.trim() || undefined)}>
              {text.trim() ? 'Empezar con esto' : 'Empezar'}
            </Button>
            {text.trim() ? (
              <Button block variant="ghost" onClick={() => start()}>
                Saltar e ir a las preguntas
              </Button>
            ) : (
              <Button block variant="secondary" onClick={() => navigate(domain.path('biblioteca'))}>
                Explorar la biblioteca
              </Button>
            )}
          </>
        )}
      </section>
      {last && (
        <Card className="mb-4 gap-2 rounded-[14px] px-3.5 py-3 shadow-none">
          <Text font="label">Tu última lista</Text>
          <div className="flex items-center gap-3">
            <Cover src={last.cover} alt="" className="size-12 flex-none rounded-[8px]" />
            <Link to={domain.path(`resultado/${last.id}`)} className="flex min-w-0 flex-1 flex-col">
              <strong className="truncate text-[15px]">{last.title}</strong>
              <span className="text-[13px] text-muted-foreground">
                {last.count} {domain.nounPlural} · {timeAgo(last.savedAt)}
              </span>
            </Link>
            <IconButton icon="play" label="Abrir la lista" variant="accent" onClick={() => navigate(domain.path(`resultado/${last.id}`))} />
          </div>
        </Card>
      )}
    </div>
  )
}

/**
 * Estado de "Mi YouTube" en Inicio: avisa al volver de Google (`?youtube=conectado`) y,
 * al terminar una importación, refresca temáticas y gustos (el vocabulario cambia).
 */
function useYouTubeSection(enabled: boolean) {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const status = useYouTubeStatus(enabled)
  const connect = useConnectYouTube()
  const importNow = useImportYouTube()
  const disconnect = useDisconnectYouTube()
  const job = status.data?.import?.status
  const previous = useRef(job)

  useEffect(() => {
    const result = params.get('youtube')
    if (!enabled || !result) return
    if (result === 'conectado') toast.success('¡Conectado! Estoy trayendo tu música de YouTube')
    else if (result === 'cancelado') toast('Conexión cancelada')
    else toast.error('Google no ha aceptado la conexión', { description: 'Vuelve a intentarlo desde este navegador.' })
    setParams({}, { replace: true })
    void status.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, params])

  useEffect(() => {
    if (previous.current === 'running' && job !== 'running') {
      void queryClient.invalidateQueries({ queryKey: ['domains'] })
      void queryClient.invalidateQueries({ queryKey: ['taste', 'youtube'] })
    }
    previous.current = job
  }, [job, queryClient])

  return { status, connect, importNow, disconnect, busy: connect.isPending || importNow.isPending || disconnect.isPending }
}

/** Estado de "Mi carpeta" en Inicio: recupera la carpeta recordada y lanza la identificación. */
function useFolderSection(enabled: boolean) {
  const queryClient = useQueryClient()
  const state = useFolderState()
  const status = useFolderStatus(enabled)
  const forget = useForgetFolder()

  useEffect(() => {
    if (enabled) void restoreFolder()
  }, [enabled])

  const fail = (e: unknown) => toast.error('No he podido leer la carpeta', { description: (e as Error).message })
  const choose = () =>
    chooseFolder().then((files) => {
      if (!files) return
      if (!files.length) return toast('No he encontrado canciones', { description: 'Busco mp3, m4a, flac, ogg, opus y wav.' })
      void importFolder(files, queryClient)
    }, fail)
  return {
    state,
    status,
    forget,
    choose,
    reconnect: () =>
      reconnectFolder().then((ok) => {
        if (ok) void importFolder(allLocalFiles(), queryClient)
      }, fail),
    // En móvil "añadir" abre el selector de canciones; con carpeta, vuelve a mirar la ya elegida.
    analyzeAudio: () => void analyzeAudio(queryClient),
    importNew: () => (songsOnlyDevice() ? void choose() : void importFolder(allLocalFiles(), queryClient)),
  }
}
