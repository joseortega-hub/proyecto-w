import { describe, expect, it } from 'vitest'
import { activeFirst } from './filters'

describe('activeFirst', () => {
  const options = ['a', 'b', 'c', 'd'].map((key) => ({ key }))
  it('pone las activas delante sin perder ninguna', () => {
    expect(activeFirst(options, ['c', 'a']).map((o) => o.key)).toEqual(['a', 'c', 'b', 'd'])
  })
  it('sin activas deja el orden igual', () => {
    expect(activeFirst(options, []).map((o) => o.key)).toEqual(['a', 'b', 'c', 'd'])
  })
})
