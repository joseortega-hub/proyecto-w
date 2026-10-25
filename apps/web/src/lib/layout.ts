// Estructura de la interfaz dentro de cada temática, a elegir como el tema de color:
// barra inferior tipo app, biblioteca con carril lateral o dock flotante. Se guarda en el navegador.
import { useCallback, useSyncExternalStore } from 'react'
import type { IconName } from '@/components/atoms'

export type LayoutId = 'app' | 'library' | 'dock'

export const LAYOUTS: { id: LayoutId; label: string; description: string; icon: IconName }[] = [
  { id: 'app', label: 'Clásica', description: 'Pestañas abajo en el móvil y menú lateral en el ordenador.', icon: 'bottomBar' },
  { id: 'library', label: 'Biblioteca', description: 'Un carril de iconos a la izquierda y tus temáticas siempre a mano.', icon: 'sidebar' },
  { id: 'dock', label: 'Dock', description: 'Una barra flotante con acceso directo a una entrevista nueva.', icon: 'orbit' },
]

export const DEFAULT_LAYOUT: LayoutId = 'app'
const KEY = 'sintonia.layout'

export function parseLayout(raw: string | null): LayoutId {
  return LAYOUTS.some((l) => l.id === raw) ? (raw as LayoutId) : DEFAULT_LAYOUT
}

function read(): LayoutId {
  try {
    return parseLayout(localStorage.getItem(KEY))
  } catch {
    return DEFAULT_LAYOUT
  }
}

let cache = read()
const listeners = new Set<() => void>()
function subscribe(cb: () => void) {
  listeners.add(cb)
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

export function useLayout() {
  const layout = useSyncExternalStore(subscribe, () => cache, () => DEFAULT_LAYOUT)
  const setLayout = useCallback((next: LayoutId) => {
    cache = next
    try {
      if (next === DEFAULT_LAYOUT) localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, next)
    } catch {
      /* sin almacenamiento: vale hasta recargar */
    }
    listeners.forEach((l) => l())
  }, [])
  return { layout, setLayout }
}
