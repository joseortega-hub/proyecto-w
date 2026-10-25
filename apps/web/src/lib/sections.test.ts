import { describe, expect, it } from 'vitest'
import { parseHidden, toggleHidden } from './sections'

describe('parseHidden', () => {
  it('lee las secciones conocidas sin repetir', () => {
    expect(parseHidden(JSON.stringify(['item.tags', 'item.tags', 'result.vibe']))).toEqual(['item.tags', 'result.vibe'])
  })

  it('descarta datos rotos o secciones que ya no existen', () => {
    expect(parseHidden('{no es json')).toEqual([])
    expect(parseHidden(JSON.stringify({ a: 1 }))).toEqual([])
    expect(parseHidden(JSON.stringify(['vieja.seccion', 3, 'item.similar']))).toEqual(['item.similar'])
    expect(parseHidden(null)).toEqual([])
  })
})

describe('toggleHidden', () => {
  it('oculta y vuelve a enseñar', () => {
    const hidden = toggleHidden([], 'item.tags', true)
    expect(hidden).toEqual(['item.tags'])
    expect(toggleHidden(hidden, 'item.tags', true)).toEqual(['item.tags'])
    expect(toggleHidden(hidden, 'item.tags', false)).toEqual([])
  })
})
