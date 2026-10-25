// Secciones que cada persona puede ocultar si no las usa (en el inicio, el resultado y la
// ficha) y recuperar desde «Personalizar». Se guardan en este navegador: no hay cuentas.
import { useCallback, useSyncExternalStore } from 'react'

export interface SectionInfo {
  id: string
  label: string
}

export interface SectionGroup {
  label: string
  sections: SectionInfo[]
}

export const SECTION_GROUPS: SectionGroup[] = [
  {
    label: 'Inicio',
    sections: [{ id: 'today.combo', label: 'El combo de esta noche' }],
  },
  {
    label: 'Resultado',
    sections: [
      { id: 'result.vibe', label: 'Tu vibra' },
      { id: 'result.answers', label: 'Tus respuestas' },
      { id: 'result.stats', label: 'Candidatas y catálogo' },
      { id: 'result.learnMore', label: 'Para saber más' },
    ],
  },
  {
    label: 'Ficha',
    sections: [
      { id: 'item.tags', label: 'Etiquetas' },
      { id: 'item.tech', label: 'Ficha técnica' },
      { id: 'item.character', label: 'Carácter' },
      { id: 'item.similar', label: 'Si te gusta, prueba también' },
      { id: 'item.learnMore', label: 'Para saber más' },
    ],
  },
]

export type SectionId = string

const KEY = 'sintonia.hidden-sections'
const KNOWN = new Set(SECTION_GROUPS.flatMap((g) => g.sections.map((s) => s.id)))

/** Lee la lista guardada; descarta lo que no sea una sección conocida (versiones viejas, datos rotos). */
export function parseHidden(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && KNOWN.has(v)))] : []
  } catch {
    return []
  }
}

/** Oculta o enseña una sección; devuelve la lista nueva sin repetidos. */
export function toggleHidden(hidden: string[], id: string, hide: boolean): string[] {
  const rest = hidden.filter((h) => h !== id)
  return hide ? [...rest, id] : rest
}

function read(): string[] {
  try {
    return parseHidden(localStorage.getItem(KEY))
  } catch {
    return []
  }
}

let cache = read()
const listeners = new Set<() => void>()
function save(next: string[]) {
  cache = next
  try {
    if (next.length) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* sin almacenamiento: vale hasta recargar */
  }
  listeners.forEach((l) => l())
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  // Otra pestaña cambió las preferencias.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read()
      cb()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}
const EMPTY: string[] = []

export function useHiddenSections() {
  const hidden = useSyncExternalStore(subscribe, () => cache, () => EMPTY)
  const setHidden = useCallback((id: SectionId, hide: boolean) => save(toggleHidden(cache, id, hide)), [])
  const showAll = useCallback(() => save([]), [])
  const isHidden = useCallback((id: SectionId) => hidden.includes(id), [hidden])
  return { hidden, isHidden, setHidden, showAll }
}
