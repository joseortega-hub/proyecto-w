import { describe, expect, it } from 'vitest'
import { nextIndex, previousIndex, reindex, shuffledOrder } from './queue-order'

describe('queue-order', () => {
  it('el aleatorio empieza por la que suena y no repite', () => {
    const order = shuffledOrder(6, 3)
    expect(order[0]).toBe(3)
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5])
  })
  it('sin aleatorio respeta el orden de la lista y acaba o vuelve al principio', () => {
    expect(nextIndex({ index: 0, length: 3, order: null, repeat: 'off', auto: true })).toBe(1)
    expect(nextIndex({ index: 2, length: 3, order: null, repeat: 'off', auto: true })).toBeNull()
    expect(nextIndex({ index: 2, length: 3, order: null, repeat: 'all', auto: true })).toBe(0)
  })
  it('repetir una solo cuando termina sola', () => {
    expect(nextIndex({ index: 1, length: 3, order: null, repeat: 'one', auto: true })).toBe(1)
    expect(nextIndex({ index: 1, length: 3, order: null, repeat: 'one', auto: false })).toBe(2)
  })
  it('con aleatorio sigue su orden', () => {
    const order = [2, 0, 1]
    expect(nextIndex({ index: 2, length: 3, order, repeat: 'off', auto: true })).toBe(0)
    expect(nextIndex({ index: 1, length: 3, order, repeat: 'off', auto: true })).toBeNull()
    expect(previousIndex(0, order)).toBe(2)
  })
  it('reindex encuentra la canción que suena tras reordenar', () => {
    const a = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(reindex(a, 1, [a[2], a[1], a[0]])).toBe(1)
    expect(reindex(a, 0, [a[1], a[2], a[0]])).toBe(2)
    expect(reindex(a, 2, [a[0], a[1]])).toBe(1)
  })
})
