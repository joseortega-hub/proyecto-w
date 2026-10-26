import { describe, expect, it } from 'vitest'
import { upNextInList } from './up-next'

const entries = ['a', 'b', 'c', 'd'].map((id) => ({ item: { id, title: id.toUpperCase(), subtitle: null, imageUrl: null } }))

describe('upNextInList', () => {
  it('da los siguientes de la lista con su posición', () => {
    expect(upNextInList(entries, 'b', 5).map((e) => [e.index, e.title])).toEqual([
      [2, 'C'],
      [3, 'D'],
    ])
  })
  it('respeta el límite y no da nada al final o fuera de la lista', () => {
    expect(upNextInList(entries, 'a', 1)).toHaveLength(1)
    expect(upNextInList(entries, 'd', 5)).toEqual([])
    expect(upNextInList(entries, 'z', 5)).toEqual([])
  })
})
