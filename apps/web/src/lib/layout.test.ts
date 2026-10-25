import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, parseLayout } from './layout'

describe('parseLayout', () => {
  it('acepta las estructuras conocidas y vuelve a la clásica si no', () => {
    expect(parseLayout('dock')).toBe('dock')
    expect(parseLayout('library')).toBe('library')
    expect(parseLayout('radial-viejo')).toBe(DEFAULT_LAYOUT)
    expect(parseLayout(null)).toBe(DEFAULT_LAYOUT)
  })
})
