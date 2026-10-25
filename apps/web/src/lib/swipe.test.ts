import { describe, expect, it } from 'vitest'
import type { ResultEntry } from './api'
import { EMPTY_SWIPE, classifySwipe, freshExtras, nextSeeds, parseSwipeState, pile, pushStep, type SwipeState } from './swipe'

const entry = (id: string): ResultEntry => ({
  match: 80,
  fit: null,
  reason: '',
  item: { id, domainId: 'movies', source: 'tmdb', externalId: id, title: id.toUpperCase(), subtitle: null, description: null, imageUrl: null, mediaUrl: null, externalUrl: null, durationSec: null, attributes: {}, tags: [], popularity: 0 },
})
const list = ['a', 'b', 'c'].map(entry)
const step = (itemId: string, verdict: 'like' | 'nope', before: ResultEntry[] | null = null) => ({ itemId, verdict, previous: null, before })

describe('classifySwipe', () => {
  it('derecha es me gusta, izquierda no y arriba la ficha', () => {
    expect(classifySwipe(120, 10, 320)).toBe('like')
    expect(classifySwipe(-120, -20, 320)).toBe('nope')
    expect(classifySwipe(10, -130, 320)).toBe('detail')
  })
  it('si no llega, la tarjeta vuelve a su sitio (y abajo no hace nada)', () => {
    expect(classifySwipe(50, 0, 320)).toBeNull()
    expect(classifySwipe(0, 200, 320)).toBeNull()
    // En pantallas anchas hace falta recorrer más (28 % del ancho).
    expect(classifySwipe(100, 0, 600)).toBeNull()
  })
  it('un golpe rápido cuenta aunque sea corto, pero no si va en contra', () => {
    expect(classifySwipe(40, 0, 320, 0.9)).toBe('like')
    expect(classifySwipe(40, 0, 320, -0.9)).toBeNull()
    expect(classifySwipe(0, -40, 320, 0, -0.9)).toBe('detail')
  })
})

describe('pile', () => {
  it('sigue el orden de la lista, luego las extra, sin repetir ni lo ya decidido', () => {
    const state: SwipeState = { steps: [step('a', 'like')], extras: [entry('c'), entry('d')], seeds: [] }
    expect(pile(list, state).map((e) => e.item.id)).toEqual(['b', 'c', 'd'])
  })
})

describe('nextSeeds', () => {
  it('parte de lo último que ha gustado y nunca repite semilla', () => {
    const state: SwipeState = { steps: [step('a', 'like'), step('b', 'nope'), step('c', 'like')], extras: [], seeds: ['c'] }
    expect(nextSeeds(list, state)).toEqual(['a'])
  })
  it('sin 👍 todavía, usa la lista (sin lo descartado)', () => {
    const state: SwipeState = { steps: [step('a', 'nope')], extras: [], seeds: [] }
    expect(nextSeeds(list, state)).toEqual(['b', 'c'])
  })
})

describe('freshExtras', () => {
  it('quita lo que ya está, lo decidido y lo que tiene 👎 en el perfil', () => {
    const state: SwipeState = { steps: [step('x', 'nope')], extras: [entry('d')], seeds: [] }
    const found = ['a', 'd', 'x', 'y', 'z', 'z'].map(entry)
    expect(freshExtras(found, list, state, { y: 'down' }).map((e) => e.item.id)).toEqual(['z'])
  })
})

describe('pushStep', () => {
  it('solo el último gesto guarda la lista anterior (deshacer va de uno en uno)', () => {
    const one = pushStep(EMPTY_SWIPE, step('a', 'nope', list))
    const two = pushStep(one, step('b', 'like', list))
    expect(two.steps.map((s) => !!s.before)).toEqual([false, true])
  })
})

describe('parseSwipeState', () => {
  it('lee lo guardado y empieza de cero si está roto', () => {
    const state: SwipeState = { steps: [step('a', 'like')], extras: [], seeds: ['a'] }
    expect(parseSwipeState(JSON.stringify(state))).toEqual(state)
    expect(parseSwipeState('basura')).toEqual(EMPTY_SWIPE)
    expect(parseSwipeState('{"steps":1}')).toEqual(EMPTY_SWIPE)
    expect(parseSwipeState(null)).toEqual(EMPTY_SWIPE)
  })
})
