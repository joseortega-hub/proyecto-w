import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { SessionResult } from './api'

/** Sin registro en el MVP: las listas guardadas viven en este dispositivo. */
export interface SavedList {
  id: string
  /** Cada dominio tiene sus propias listas. */
  domainId: string
  title: string
  count: number
  cover: string | null
  savedAt: string
}

const KEY = 'sintonia.lists'
const listeners = new Set<() => void>()
let cache: SavedList[] | null = null

function read(): SavedList[] {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedList[]
  } catch {
    cache = []
  }
  return cache
}

function write(lists: SavedList[]) {
  cache = lists
  try {
    localStorage.setItem(KEY, JSON.stringify(lists))
  } catch {
    /* sin almacenamiento disponible */
  }
  listeners.forEach((l) => l())
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const empty: SavedList[] = []

/** Listas de un dominio. Las guardadas antes de existir varios dominios cuentan como música. */
export function useSavedLists(domainId: string) {
  const all = useSyncExternalStore(subscribe, read, () => empty)
  const lists = useMemo(() => all.filter((l) => (l.domainId ?? 'music') === domainId), [all, domainId])
  const save = useCallback((result: SessionResult) => {
    const entry: SavedList = {
      id: result.id,
      domainId: result.domainId,
      title: result.title,
      count: result.entries.length,
      cover: result.entries[0]?.item.imageUrl ?? null,
      savedAt: new Date().toISOString(),
    }
    write([entry, ...read().filter((l) => l.id !== result.id)])
  }, [])
  /** Si la lista está guardada, pone al día su recuento y su portada tras editarla. */
  const sync = useCallback((result: SessionResult) => {
    if (!read().some((l) => l.id === result.id)) return
    write(read().map((l) => (l.id === result.id ? { ...l, count: result.entries.length, cover: result.entries[0]?.item.imageUrl ?? null } : l)))
  }, [])
  const remove = useCallback((id: string) => write(read().filter((l) => l.id !== id)), [])
  const isSaved = useCallback((id: string) => lists.some((l) => l.id === id), [lists])
  return { lists, save, sync, remove, isSaved }
}
