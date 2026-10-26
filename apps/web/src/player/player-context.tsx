import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Item } from '@/lib/api'
import { toast } from 'sonner'
import { localUrl } from '@/lib/local-files'
import { VideoDock } from './VideoDock'
import { nextIndex, previousIndex, reindex, shuffledOrder, upcomingIndices, type RepeatMode } from './queue-order'
import { loadYouTubeApi, YT_STATE, type YTPlayer } from './youtube-iframe'

export interface QueueEntry {
  item: Item
  reason: string
  match: number
}

interface PlayerState {
  queue: QueueEntry[]
  index: number
  listTitle: string
  listId: string | null
  domainId: string | null
  playing: boolean
  position: number
  duration: number
  /** Reproducción aleatoria: orden de los índices de la cola (null = en orden). */
  order: number[] | null
  repeat: RepeatMode
}

interface PlayerApi extends PlayerState {
  current: QueueEntry | null
  /** Si lo que suena es un vídeo de YouTube (reproductor IFrame) en vez de audio. */
  video: boolean
  playList: (entries: QueueEntry[], opts: { title: string; id: string; domainId: string; start?: number }) => void
  /** Cambia el contenido y el orden de la cola sin cortar lo que suena (tras editar la lista). */
  syncQueue: (entries: QueueEntry[]) => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  /** Si hay canción siguiente (con repetir toda la lista siempre la hay). */
  hasNext: boolean
  hasPrevious: boolean
  /** Índices de la cola que suenan después («A continuación»), con el orden aleatorio si está activo. */
  upcoming: number[]
  /** Salta a una posición de la cola y la reproduce. */
  jumpTo: (index: number) => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  /** Cierra el reproductor: para el audio o el vídeo y vacía la cola (desaparecen mini-reproductor y vídeo). */
  stop: () => void
  /**
   * Ref de callback para un hueco donde se coloca el vídeo de YouTube (la portada del
   * mini-reproductor, de la barra o del reproductor completo). Se usa el hueco visible más grande.
   */
  setVideoSlot: (el: HTMLElement | null) => (() => void) | undefined
  /** Carga la API de YouTube por adelantado, para que el primer toque ya suene (móvil). */
  prepareVideo: () => void
}

const PlayerContext = createContext<PlayerApi | null>(null)

/** Las canciones de "Mi YouTube" se reproducen con el reproductor oficial de YouTube. */
const isVideo = (entry: QueueEntry | null | undefined) => entry?.item.source === 'youtube'

/**
 * Un único reproductor para toda la app: la música sigue sonando al cambiar de pantalla.
 * Dos motores detrás de la misma interfaz: un <audio> (Jamendo o un archivo local de "Mi carpeta") y el IFrame de YouTube.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const yt = useRef<YTPlayer | null>(null)
  const ytReady = useRef<Promise<YTPlayer> | null>(null)
  const videoHost = useRef<HTMLDivElement>(null)
  const [videoSlots, setVideoSlots] = useState<HTMLElement[]>([])
  // React 19: la ref de callback devuelve su limpieza, así se sabe qué hueco desaparece.
  const setVideoSlot = useCallback((el: HTMLElement | null) => {
    if (!el) return undefined
    setVideoSlots((slots) => (slots.includes(el) ? slots : [...slots, el]))
    return () => setVideoSlots((slots) => slots.filter((s) => s !== el))
  }, [])
  const [state, setState] = useState<PlayerState>({
    queue: [],
    index: 0,
    listTitle: '',
    listId: null,
    domainId: null,
    playing: false,
    position: 0,
    duration: 0,
    order: null,
    repeat: 'off',
  })
  const current = state.queue[state.index] ?? null
  const video = isVideo(current)
  const stateRef = useRef(state)
  stateRef.current = state
  const goToRef = useRef<(index: number) => void>(() => undefined)
  const advanceRef = useRef<(auto: boolean) => void>(() => undefined)

  if (!audio.current && typeof Audio !== 'undefined') audio.current = new Audio()

  const ensureYouTube = useCallback(() => {
    ytReady.current ??= loadYouTubeApi().then(
      (YT) =>
        new Promise<YTPlayer>((resolve) => {
          const el = document.createElement('div')
          videoHost.current?.appendChild(el)
          const player = new YT.Player(el, {
            width: '100%',
            height: '100%',
            // Sin controles de YouTube: se maneja solo con los de Sintonía (un único reproductor).
            playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, origin: window.location.origin },
            events: {
              onReady: () => {
                yt.current = player
                resolve(player)
              },
              onStateChange: ({ data }) => {
                // Los eventos de un vídeo que ya no suena (se pasó a audio) no cuentan.
                if (!isVideo(stateRef.current.queue[stateRef.current.index])) return
                if (data === YT_STATE.PLAYING) setState((s) => ({ ...s, playing: true }))
                else if (data === YT_STATE.PAUSED) setState((s) => ({ ...s, playing: false }))
                else if (data === YT_STATE.ENDED) advanceRef.current(true)
              },
              // Vídeo retirado o que no se deja incrustar: a la siguiente.
              onError: () => advanceRef.current(false),
            },
          })
        }),
    )
    ytReady.current.catch(() => (ytReady.current = null))
    return ytReady.current
  }, [])

  const load = useCallback(
    (entry: QueueEntry | undefined) => {
      const el = audio.current
      if (isVideo(entry)) {
        el?.pause()
        const id = entry!.item.externalId
        if (yt.current) yt.current.loadVideoById(id)
        else void ensureYouTube().then((p) => p.loadVideoById(id))
        return
      }
      yt.current?.pauseVideo()
      if (entry?.item.source === 'local') {
        // "Mi carpeta": el audio suena desde el dispositivo, nunca pasa por el servidor.
        const url = localUrl(entry.item.externalId)
        if (!url || !el) {
          toast.error('No encuentro ese archivo en tu dispositivo', { description: 'Vuelve a elegir tu carpeta en Inicio.' })
          return setState((s) => ({ ...s, playing: false }))
        }
        el.src = url
        el.play().catch(() => setState((s) => ({ ...s, playing: false })))
        return
      }
      if (!el || !entry?.item.mediaUrl) return
      el.src = entry.item.mediaUrl
      el.play().catch(() => setState((s) => ({ ...s, playing: false })))
    },
    [ensureYouTube],
  )

  const goTo = useCallback(
    (index: number) => {
      const { queue } = stateRef.current
      if (index < 0 || index >= queue.length) return
      load(queue[index])
      setState((s) => ({ ...s, index, position: 0 }))
    },
    [load],
  )
  goToRef.current = goTo

  /** Pasa a la siguiente: en orden (el editado) o aleatoria; al final, para o vuelve a empezar si se repite. */
  const advance = useCallback(
    (auto: boolean) => {
      const { index, queue, order, repeat } = stateRef.current
      const target = nextIndex({ index, length: queue.length, order, repeat, auto })
      // Fin de la lista: se queda parado (el vídeo deja de flotar).
      if (target === null) {
        if (auto) setState((s) => ({ ...s, playing: false }))
        return
      }
      // Con aleatorio y "repetir todo", al llegar al final se baraja de nuevo.
      if (order && order.indexOf(index) === order.length - 1) setState((s) => ({ ...s, order: shuffledOrder(queue.length, target) }))
      if (target === index && auto) {
        // Repetir la misma: se reinicia sin recargar.
        if (isVideo(queue[index])) yt.current?.seekTo(0, true)
        else if (audio.current) audio.current.currentTime = 0
        if (isVideo(queue[index])) yt.current?.playVideo()
        else audio.current?.play().catch(() => undefined)
        return
      }
      goTo(target)
    },
    [goTo],
  )
  advanceRef.current = advance

  useEffect(() => {
    const el = audio.current
    if (!el) return
    const onTime = () => setState((s) => ({ ...s, position: el.currentTime, duration: el.duration || s.duration }))
    const onPlay = () => setState((s) => ({ ...s, playing: true }))
    const onPause = () => setState((s) => (isVideo(s.queue[s.index]) ? s : { ...s, playing: false }))
    const onEnded = () => advanceRef.current(true)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onTime)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onTime)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
    }
  }, [])

  // El IFrame no emite "timeupdate": se pregunta la posición mientras suena.
  useEffect(() => {
    if (!video || !state.playing) return
    const timer = window.setInterval(() => {
      const p = yt.current
      if (p) setState((s) => ({ ...s, position: p.getCurrentTime(), duration: p.getDuration() || s.duration }))
    }, 500)
    return () => window.clearInterval(timer)
  }, [video, state.playing])

  const playList = useCallback<PlayerApi['playList']>(
    (entries, { title, id, domainId, start = 0 }) => {
      setState((s) => ({ ...s, queue: entries, index: start, listTitle: title, listId: id, domainId, position: 0, duration: 0, order: s.order ? shuffledOrder(entries.length, start) : null }))
      load(entries[start])
    },
    [load],
  )

  const toggle = useCallback(() => {
    if (isVideo(stateRef.current.queue[stateRef.current.index])) {
      const p = yt.current
      if (!p) return
      if (p.getPlayerState() === YT_STATE.PLAYING) p.pauseVideo()
      else p.playVideo()
      return
    }
    const el = audio.current
    if (!el || !el.src) return
    if (el.paused) el.play().catch(() => undefined)
    else el.pause()
  }, [])

  const syncQueue = useCallback((entries: QueueEntry[]) => {
    setState((s) => {
      const index = reindex(s.queue.map((e) => ({ id: e.item.id })), s.index, entries.map((e) => ({ id: e.item.id })))
      return { ...s, queue: entries, index, order: s.order ? shuffledOrder(entries.length, index) : null }
    })
  }, [])
  const toggleShuffle = useCallback(() => setState((s) => ({ ...s, order: s.order ? null : shuffledOrder(s.queue.length, s.index) })), [])
  const cycleRepeat = useCallback(() => setState((s) => ({ ...s, repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })), [])
  const hasNext = nextIndex({ index: state.index, length: state.queue.length, order: state.order, repeat: state.repeat, auto: false }) !== null

  const upcoming = useMemo(
    () => upcomingIndices({ index: state.index, length: state.queue.length, order: state.order, repeat: state.repeat, limit: 5 }),
    [state.index, state.queue.length, state.order, state.repeat],
  )
  const hasPrevious = state.order ? state.order.indexOf(state.index) > 0 : state.index > 0

  const next = useCallback(() => advance(false), [advance])
  const previous = useCallback(() => {
    const position = video ? (yt.current?.getCurrentTime() ?? 0) : (audio.current?.currentTime ?? 0)
    if (position > 3) {
      if (video) yt.current?.seekTo(0, true)
      else if (audio.current) audio.current.currentTime = 0
    } else goTo(previousIndex(state.index, state.order))
  }, [goTo, state.index, state.order, video])
  const seek = useCallback(
    (seconds: number) => {
      if (video) yt.current?.seekTo(seconds, true)
      else if (audio.current) audio.current.currentTime = seconds
    },
    [video],
  )
  const stop = useCallback(() => {
    audio.current?.pause()
    audio.current?.removeAttribute('src')
    yt.current?.stopVideo()
    setState((s) => ({ ...s, queue: [], index: 0, listTitle: '', listId: null, domainId: null, playing: false, position: 0, duration: 0, order: null }))
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
  }, [])

  // Al desmontar el proveedor (recarga en caliente, Storybook) no queda ningún IFrame colgado.
  useEffect(
    () => () => {
      yt.current?.destroy()
      yt.current = null
      ytReady.current = null
      audio.current?.pause()
    },
    [],
  )

  const prepareVideo = useCallback(() => void ensureYouTube().catch(() => undefined), [ensureYouTube])

  // Controles en la pantalla de bloqueo del móvil (Media Session API).
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.item.title,
      artist: current.item.subtitle ?? '',
      album: state.listTitle,
      artwork: current.item.imageUrl ? [{ src: current.item.imageUrl, sizes: '300x300' }] : [],
    })
    navigator.mediaSession.setActionHandler('play', toggle)
    navigator.mediaSession.setActionHandler('pause', toggle)
    navigator.mediaSession.setActionHandler('nexttrack', next)
    navigator.mediaSession.setActionHandler('previoustrack', previous)
  }, [current, state.listTitle, toggle, next, previous])

  const value = useMemo<PlayerApi>(
    () => ({ ...state, current, video, hasNext, hasPrevious, upcoming, jumpTo: goTo, syncQueue, toggleShuffle, cycleRepeat, playList, toggle, next, previous, seek, stop, setVideoSlot, prepareVideo }),
    [state, current, video, hasNext, hasPrevious, upcoming, goTo, syncQueue, toggleShuffle, cycleRepeat, playList, toggle, next, previous, seek, stop, setVideoSlot, prepareVideo],
  )
  return (
    <PlayerContext.Provider value={value}>
      {children}
      <VideoDock ref={videoHost} visible={video} playing={state.playing} slots={videoSlots} title={current?.item.title} onClose={stop} />
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer debe usarse dentro de <PlayerProvider>')
  return ctx
}

/**
 * Hueco para el vídeo de YouTube si lo que suena es un vídeo (si no, `undefined`). No falla
 * fuera de <PlayerProvider>, para poder pintar las piezas del reproductor sueltas (Storybook).
 */
export function usePlayerVideoSlot() {
  const ctx = useContext(PlayerContext)
  return ctx?.video ? ctx.setVideoSlot : undefined
}
