import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Item } from '@/lib/api'

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
  playing: boolean
  position: number
  duration: number
}

interface PlayerApi extends PlayerState {
  current: QueueEntry | null
  playList: (entries: QueueEntry[], opts: { title: string; id: string; start?: number }) => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
}

const PlayerContext = createContext<PlayerApi | null>(null)

/** Un único <audio> para toda la app: la música sigue sonando al cambiar de pantalla. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [state, setState] = useState<PlayerState>({
    queue: [],
    index: 0,
    listTitle: '',
    listId: null,
    playing: false,
    position: 0,
    duration: 0,
  })
  const current = state.queue[state.index] ?? null
  const stateRef = useRef(state)
  stateRef.current = state

  if (!audio.current && typeof Audio !== 'undefined') audio.current = new Audio()

  const load = useCallback((entry: QueueEntry | undefined) => {
    const el = audio.current
    if (!el || !entry?.item.mediaUrl) return
    el.src = entry.item.mediaUrl
    el.play().catch(() => setState((s) => ({ ...s, playing: false })))
  }, [])

  const goTo = useCallback(
    (index: number) => {
      const { queue } = stateRef.current
      if (index < 0 || index >= queue.length) return
      load(queue[index])
      setState((s) => ({ ...s, index, position: 0 }))
    },
    [load],
  )

  useEffect(() => {
    const el = audio.current
    if (!el) return
    const onTime = () => setState((s) => ({ ...s, position: el.currentTime, duration: el.duration || s.duration }))
    const onPlay = () => setState((s) => ({ ...s, playing: true }))
    const onPause = () => setState((s) => ({ ...s, playing: false }))
    const onEnded = () => goTo(stateRef.current.index + 1)
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
  }, [goTo])

  const playList = useCallback<PlayerApi['playList']>(
    (entries, { title, id, start = 0 }) => {
      setState((s) => ({ ...s, queue: entries, index: start, listTitle: title, listId: id, position: 0, duration: 0 }))
      load(entries[start])
    },
    [load],
  )

  const toggle = useCallback(() => {
    const el = audio.current
    if (!el || !el.src) return
    if (el.paused) el.play().catch(() => undefined)
    else el.pause()
  }, [])

  const next = useCallback(() => goTo(state.index + 1), [goTo, state.index])
  const previous = useCallback(() => {
    const el = audio.current
    if (el && el.currentTime > 3) el.currentTime = 0
    else goTo(Math.max(0, state.index - 1))
  }, [goTo, state.index])
  const seek = useCallback((seconds: number) => {
    if (audio.current) audio.current.currentTime = seconds
  }, [])

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
    () => ({ ...state, current, playList, toggle, next, previous, seek }),
    [state, current, playList, toggle, next, previous, seek],
  )
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer debe usarse dentro de <PlayerProvider>')
  return ctx
}
