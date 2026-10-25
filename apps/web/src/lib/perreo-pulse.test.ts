import { describe, expect, it } from 'vitest'
import { artistOfTheDay, barWidth, compactNumber, countUp, releaseWhen } from './perreo-pulse'
import type { PerreoArtist } from './perreo-types'

describe('cifras del pulso', () => {
  it('abrevia en español', () => {
    expect(compactNumber(null)).toBe('—')
    expect(compactNumber(950)).toBe('950')
    expect(compactNumber(12_400)).toBe('12,4 mil')
    expect(compactNumber(3_400_000)).toBe('3,4 M')
    expect(compactNumber(150_000_000)).toBe('150 M')
    expect(compactNumber(2_100_000_000)).toBe('2,1 mil M')
  })

  it('las barras del cara a cara: sin dato no se pintan; con poco, se ven', () => {
    expect(barWidth(null)).toBe(0)
    expect(barWidth(0.001)).toBe(0.04)
    expect(barWidth(0.6)).toBe(0.6)
    expect(barWidth(3)).toBe(1)
  })

  it('el marcador sube y frena hasta el valor exacto', () => {
    expect(countUp(1000, 0)).toBe(0)
    expect(countUp(1000, 0.5)).toBeGreaterThan(500)
    expect(countUp(1000, 1)).toBe(1000)
    expect(countUp(1000, 2)).toBe(1000)
  })
})

describe('cuándo sale', () => {
  const now = new Date('2026-10-25T12:00:00Z')
  it('fechas cercanas en palabras y el resto con fecha', () => {
    expect(releaseWhen('2026-10-25', now)).toBe('Hoy')
    expect(releaseWhen('2026-10-24', now)).toBe('Ayer')
    expect(releaseWhen('2026-10-22', now)).toBe('Hace 3 días')
    expect(releaseWhen('2026-10-26', now)).toBe('Mañana')
    expect(releaseWhen('2026-11-06', now)).toBe('En 12 días')
    expect(releaseWhen('2026-12-05', now)).toBe('5 dic 2026')
    expect(releaseWhen('2026-03-01', now)).toBe('1 mar 2026')
    expect(releaseWhen('2027', now)).toBe('2027')
    expect(releaseWhen('2026-11', now)).toBe('nov 2026')
  })
})

describe('artista del día', () => {
  const a = (slug: string, extra: Partial<PerreoArtist> = {}) => ({ slug, name: slug, kind: 'artist', photoV: 'x', countries: [], styles: [], labels: [], fame: 1, city: null, debutYear: null, followed: false, incomplete: false, ...extra }) as PerreoArtist
  const list = [a('b'), a('a'), a('c'), a('sello', { kind: 'label' }), a('sin-foto', { photoV: null })]
  it('es el mismo todo el día, sin importar el orden, y solo artistas con foto', () => {
    const d = new Date('2026-10-26T08:00:00Z')
    const pick = artistOfTheDay(list, d)!
    expect(['a', 'b', 'c']).toContain(pick.slug)
    expect(artistOfTheDay([...list].reverse(), new Date('2026-10-26T22:00:00Z'))!.slug).toBe(pick.slug)
    expect(artistOfTheDay([], d)).toBeNull()
  })
})
