import { useCallback, useSyncExternalStore } from 'react'

/** Tamaño de lista que elige la persona. Los límites coinciden con los de la API (`list-size.ts`). */
export interface ListSize {
  min: number
  max: number
}
export const SIZE_LIMITS: ListSize = { min: 5, max: 50 }
export const DEFAULT_SIZE: ListSize = { min: 10, max: 20 }
/** YouTube cobra unas 50 unidades de cuota por canción al guardar la lista. */
export const YOUTUBE_UNITS_PER_ITEM = 50
export const YOUTUBE_DAILY_QUOTA = 10_000

const key = (domainId: string) => `sintonia.listSize.${domainId}`
const listeners = new Set<() => void>()
const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

const clamp = (n: number) => Math.min(SIZE_LIMITS.max, Math.max(SIZE_LIMITS.min, Math.round(n)))

/** Rango válido a partir de lo guardado (o el de por defecto si falta o está roto). */
export function parseSize(raw: string | null): ListSize {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<ListSize> | null
    if (v && Number.isFinite(v.min) && Number.isFinite(v.max)) {
      const a = clamp(v.min as number)
      const b = clamp(v.max as number)
      return { min: Math.min(a, b), max: Math.max(a, b) }
    }
  } catch {
    /* se usa el de por defecto */
  }
  return DEFAULT_SIZE
}

const cache = new Map<string, { raw: string | null; value: ListSize }>()

/** Lo guardado para esta temática en este dispositivo. */
export function readListSize(domainId: string): ListSize {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key(domainId))
  } catch {
    /* sin almacenamiento */
  }
  const hit = cache.get(domainId)
  if (hit && hit.raw === raw) return hit.value
  const value = parseSize(raw)
  cache.set(domainId, { raw, value })
  return value
}

export function writeListSize(domainId: string, size: ListSize) {
  try {
    localStorage.setItem(key(domainId), JSON.stringify(size))
  } catch {
    /* sin almacenamiento */
  }
  listeners.forEach((l) => l())
}

/** Tamaño de lista de una temática, recordado por dispositivo. */
export function useListSize(domainId: string) {
  const size = useSyncExternalStore(subscribe, () => readListSize(domainId), () => DEFAULT_SIZE)
  const setSize = useCallback((next: ListSize) => writeListSize(domainId, next), [domainId])
  return [size, setSize] as const
}

/** Aviso del coste en cuota de guardar la lista en YouTube; `null` si son 20 o menos. */
export function youtubeQuotaWarning(count: number): string | null {
  if (count <= 20) return null
  const units = count * YOUTUBE_UNITS_PER_ITEM
  return `Guardar ${count} canciones cuesta unas ${units.toLocaleString('es-ES')} unidades de tu cuota diaria de YouTube (${YOUTUBE_DAILY_QUOTA.toLocaleString('es-ES')}). ¿Seguimos?`
}
