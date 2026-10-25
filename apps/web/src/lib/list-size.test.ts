import { describe, expect, it } from 'vitest'
import { DEFAULT_SIZE, parseSize, youtubeQuotaWarning } from './list-size'

describe('list-size', () => {
  it('lee lo guardado dentro de 5–50 y cae al de por defecto si está roto', () => {
    expect(parseSize('{"min":2,"max":99}')).toEqual({ min: 5, max: 50 })
    expect(parseSize('{"min":30,"max":12}')).toEqual({ min: 12, max: 30 })
    expect(parseSize('basura')).toEqual(DEFAULT_SIZE)
    expect(parseSize(null)).toEqual(DEFAULT_SIZE)
  })
  it('avisa del coste en cuota solo con más de 20', () => {
    expect(youtubeQuotaWarning(20)).toBeNull()
    expect(youtubeQuotaWarning(30)).toMatch(/30 canciones.*1\.?500/)
  })
})
