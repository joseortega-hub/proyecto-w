// Estructura de la interfaz dentro de cada temática, a elegir como el tema de color. Todas
// piensan primero en el móvil (375 px) y tienen su versión de escritorio. Se guarda en el navegador.
import { useCallback, useSyncExternalStore } from 'react'
import type { IconName } from '@/components/atoms'

export type LayoutId = 'app' | 'library' | 'dock' | 'thumb' | 'focus'

export const LAYOUTS: { id: LayoutId; label: string; description: string; icon: IconName }[] = [
  { id: 'app', label: 'Clásica', description: 'Temática y ajustes arriba, secciones abajo. En el ordenador, menú lateral.', icon: 'bottomBar' },
  { id: 'library', label: 'Biblioteca', description: 'Secciones en pestañas arriba y toda la pantalla libre abajo. En el ordenador, carril y columna de temáticas.', icon: 'sidebar' },
  { id: 'dock', label: 'Dock', description: 'Una barra flotante con una entrevista nueva siempre en el centro.', icon: 'orbit' },
  { id: 'thumb', label: 'Una mano', description: 'Todo abajo, al alcance del pulgar. Desliza la barra a los lados para cambiar de temática.', icon: 'swipe' },
  { id: 'focus', label: 'Enfoque', description: 'Las barras se esconden al bajar y vuelven al subir: más pantalla para el contenido.', icon: 'eye' },
]

export const DEFAULT_LAYOUT: LayoutId = 'app'
const KEY = 'sintonia.layout'

/** Nombres de versiones anteriores o probados en desarrollo: se traducen a la estructura que los sustituye. */
const LEGACY: Record<string, LayoutId> = { rail: 'library', sidebar: 'library', bottom: 'app', classic: 'app', floating: 'dock', 'one-hand': 'thumb', immersive: 'focus' }

export function parseLayout(raw: string | null): LayoutId {
  if (raw && Object.hasOwn(LEGACY, raw)) return LEGACY[raw]!
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

export const getLayout = () => cache

export function setLayout(next: LayoutId) {
  cache = parseLayout(next)
  try {
    if (cache === DEFAULT_LAYOUT) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, cache)
  } catch {
    /* sin almacenamiento: vale hasta recargar */
  }
  listeners.forEach((l) => l())
}

export function useLayout() {
  const layout = useSyncExternalStore(subscribe, () => cache, () => DEFAULT_LAYOUT)
  return { layout, setLayout: useCallback((next: LayoutId) => setLayout(next), []) }
}

/**
 * La estructura solo cambia el marco de las temáticas. Fuera de ellas («Hoy para ti», «Tu
 * historia») y en el Modo Perreo, que tiene su propio marco, elegirla no cambia nada a la
 * vista: sin este aviso parecía que el selector no funcionaba.
 */
export function layoutNotice(domainId: string, layout: LayoutId): { title: string; description: string } | null {
  if (domainId && domainId !== 'perreo') return null
  const label = LAYOUTS.find((l) => l.id === layout)?.label ?? 'Clásica'
  return {
    title: `Estructura «${label}» guardada`,
    description:
      domainId === 'perreo'
        ? 'El Modo Perreo tiene su propio diseño. La verás en el resto de temáticas.'
        : 'La verás al entrar en una temática, como Música o Películas.',
  }
}

/**
 * «Una mano»: un deslizamiento horizontal claro sobre la barra cambia de temática.
 * Devuelve -1 (anterior, dedo hacia la derecha), 1 (siguiente) o 0 si no cuenta como gesto.
 */
export function swipeStep(dx: number, dy: number, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? 1 : -1
}

/** Índice siguiente en una lista circular. */
export const cycleIndex = (index: number, step: number, length: number) => (length ? (((index + step) % length) + length) % length : 0)

export interface ChromeState {
  hidden: boolean
  /** Posición desde la que se mide el siguiente cambio de dirección. */
  anchor: number
}

/**
 * «Enfoque»: las barras se esconden al bajar y vuelven al subir. Se cuenta desde la última
 * posición en la que cambiaron (no desde el evento anterior, que llega a trocitos de pocos
 * píxeles), con un margen para no parpadear, y cerca del principio siempre se ven.
 */
export function nextChrome(state: ChromeState, y: number, threshold = 16, top = 56): ChromeState {
  if (y <= top) return { hidden: false, anchor: y }
  const d = y - state.anchor
  if (state.hidden ? d < -threshold : d > threshold) return { hidden: !state.hidden, anchor: y }
  // En la dirección de lo que ya se ve, el ancla avanza con el desplazamiento.
  if (state.hidden ? d > 0 : d < 0) return { ...state, anchor: y }
  return state
}
