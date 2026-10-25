// «Desliza»: lógica pura de la pila de tarjetas del resultado (gestos, pila, semillas y memoria).
import { flushSync } from 'react-dom'
import type { Feedback, ResultEntry } from './api'

export type Verdict = 'like' | 'nope'
export type Gesture = Verdict | 'detail'
export type ResultLayout = 'list' | 'swipe'

/** Un gesto ya hecho: lo justo para deshacerlo. */
export interface SwipeStep {
  itemId: string
  verdict: Verdict
  /** 👍/👎 que tenía antes del gesto (para devolverlo al deshacer). */
  previous: Feedback | null
  /** Lista antes del gesto, solo si el gesto la cambió y es el último (deshacer va de uno en uno). */
  before: ResultEntry[] | null
}

export interface SwipeState {
  steps: SwipeStep[]
  /** Candidatas extra pedidas cuando la pila se acaba (parecidas a lo que gusta). */
  extras: ResultEntry[]
  /** Elementos ya usados como semilla de parecidos. */
  seeds: string[]
}

export const EMPTY_SWIPE: SwipeState = { steps: [], extras: [], seeds: [] }

/** Distancia mínima (px) para que soltar cuente como gesto, o la fracción del ancho si es mayor. */
const MIN_DISTANCE = 80
const WIDTH_SHARE = 0.28
/** Un golpe rápido (px/ms) cuenta aunque se recorra menos. */
const FLICK_SPEED = 0.6
const FLICK_DISTANCE = 36

/**
 * Qué gesto es soltar la tarjeta tras moverla `dx`, `dy` (px) en una tarjeta de `width` px.
 * `vx`/`vy` es la velocidad final (px/ms). Arriba es «ver ficha»; si no llega, vuelve a su sitio.
 */
export function classifySwipe(dx: number, dy: number, width: number, vx = 0, vy = 0): Gesture | null {
  const need = Math.max(MIN_DISTANCE, width * WIDTH_SHARE)
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  if (horizontal) {
    if (Math.abs(dx) >= need || (Math.abs(dx) >= FLICK_DISTANCE && Math.abs(vx) >= FLICK_SPEED && Math.sign(vx) === Math.sign(dx))) return dx > 0 ? 'like' : 'nope'
    return null
  }
  if (dy <= -need || (dy <= -FLICK_DISTANCE && vy <= -FLICK_SPEED)) return 'detail'
  return null
}

/** La pila que queda: la lista en su orden y luego las extra, sin repetir ni lo ya decidido. */
export function pile(entries: ResultEntry[], state: SwipeState): ResultEntry[] {
  const decided = new Set(state.steps.map((s) => s.itemId))
  const seen = new Set<string>()
  return [...entries, ...state.extras].filter((e) => {
    if (decided.has(e.item.id) || seen.has(e.item.id)) return false
    seen.add(e.item.id)
    return true
  })
}

/**
 * Semillas para pedir más parecidas: primero lo último que le ha gustado; sin 👍 todavía,
 * lo primero de la lista. Nunca repite semilla.
 */
export function nextSeeds(entries: ResultEntry[], state: SwipeState, count = 2): string[] {
  const used = new Set(state.seeds)
  const liked = state.steps.filter((s) => s.verdict === 'like').map((s) => s.itemId).reverse()
  const nope = new Set(state.steps.filter((s) => s.verdict === 'nope').map((s) => s.itemId))
  const fallback = liked.length ? [] : entries.map((e) => e.item.id).filter((id) => !nope.has(id))
  return [...new Set([...liked, ...fallback])].filter((id) => !used.has(id)).slice(0, count)
}

/** Las extra nuevas que valen: ni repetidas, ni en la lista, ni ya decididas, ni con 👎 guardado. */
export function freshExtras(found: ResultEntry[], entries: ResultEntry[], state: SwipeState, feedback: Record<string, Feedback> = {}): ResultEntry[] {
  const known = new Set([...entries, ...state.extras].map((e) => e.item.id).concat(state.steps.map((s) => s.itemId)))
  const out: ResultEntry[] = []
  for (const e of found) {
    if (known.has(e.item.id) || feedback[e.item.id] === 'down') continue
    known.add(e.item.id)
    out.push(e)
  }
  return out
}

/** Añade un gesto; solo el último guarda la lista anterior, para que la memoria no crezca. */
export function pushStep(state: SwipeState, step: SwipeStep): SwipeState {
  return { ...state, steps: [...state.steps.map((s) => (s.before ? { ...s, before: null } : s)), step] }
}

const swipeKey = (sessionId: string) => `sintonia:desliza:${sessionId}`
const LAYOUT_KEY = 'sintonia:result-layout'

function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

/** Lee la pila guardada (al volver de una ficha se sigue donde se dejó). Si está rota, empieza de cero. */
export function parseSwipeState(raw: string | null | undefined): SwipeState {
  try {
    const parsed = JSON.parse(raw ?? '') as Partial<SwipeState>
    if (!Array.isArray(parsed.steps) || !Array.isArray(parsed.extras) || !Array.isArray(parsed.seeds)) return EMPTY_SWIPE
    return { steps: parsed.steps, extras: parsed.extras, seeds: parsed.seeds }
  } catch {
    return EMPTY_SWIPE
  }
}

export function loadSwipeState(sessionId: string): SwipeState {
  try {
    return parseSwipeState(storage('session')?.getItem(swipeKey(sessionId)))
  } catch {
    return EMPTY_SWIPE
  }
}

export function saveSwipeState(sessionId: string, state: SwipeState) {
  try {
    storage('session')?.setItem(swipeKey(sessionId), JSON.stringify(state))
  } catch {
    // Sin almacenamiento (modo privado): la pila vive solo en memoria.
  }
}

export function loadLayout(): ResultLayout {
  try {
    return storage('local')?.getItem(LAYOUT_KEY) === 'swipe' ? 'swipe' : 'list'
  } catch {
    return 'list'
  }
}

export function saveLayout(layout: ResultLayout) {
  try {
    storage('local')?.setItem(LAYOUT_KEY, layout)
  } catch {
    // Sin almacenamiento: se recuerda solo mientras la página esté abierta.
  }
}

/** Animación de salida de la tarjeta: hacia dónde se va y desde dónde (si se arrastró). */
export interface SwipeMotion {
  kind: Gesture | 'undo-like' | 'undo-nope'
  dx?: number
  dy?: number
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Cambia la pila dentro de una View Transition (la tarjeta sale volando y entra la siguiente).
 * Sin la API, o si la persona prefiere menos movimiento, el cambio es directo.
 */
export function swipeTransition(motion: SwipeMotion, update: () => void) {
  const doc = typeof document !== 'undefined' ? (document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } }) : null
  if (!doc?.startViewTransition || prefersReducedMotion()) return update()
  const root = doc.documentElement
  root.dataset.swipe = motion.kind
  root.style.setProperty('--swipe-x', `${motion.dx ?? 0}px`)
  root.style.setProperty('--swipe-y', `${motion.dy ?? 0}px`)
  root.style.setProperty('--swipe-r', `${(motion.dx ?? 0) / 20}deg`)
  const done = () => {
    delete root.dataset.swipe
    root.style.removeProperty('--swipe-x')
    root.style.removeProperty('--swipe-y')
    root.style.removeProperty('--swipe-r')
  }
  // El cambio se aplica una sola vez: dentro de la transición o, si el navegador no pinta
  // (pestaña en segundo plano), a los 500 ms sin animación.
  let ran = false
  const run = () => {
    if (ran) return
    ran = true
    flushSync(update)
  }
  try {
    const transition = doc.startViewTransition(run) as { finished: Promise<void>; ready?: Promise<void>; updateCallbackDone?: Promise<void>; skipTransition?: () => void }
    transition.finished.then(done, done)
    // Una transición saltada rechaza estas promesas: no es un error.
    transition.ready?.catch(() => {})
    transition.updateCallbackDone?.catch(() => {})
    setTimeout(() => {
      if (ran) return
      transition.skipTransition?.()
      run()
      done()
    }, 500)
  } catch {
    done()
    run()
  }
}
