import { describe, expect, it } from 'vitest'
import type { Item } from './api'
import { itemEntity, linkHost } from './links'

const item = (domainId: string, extra: Partial<Item> = {}): Item => ({
  id: '1',
  domainId,
  source: 's',
  externalId: 'e',
  title: 'T',
  subtitle: null,
  description: null,
  imageUrl: null,
  mediaUrl: null,
  externalUrl: null,
  durationSec: null,
  attributes: {},
  tags: [],
  popularity: 0,
  ...extra,
})

describe('De qué va la ficha (para "Para saber más")', () => {
  it('películas: la saga sin "Colección"; si no hay, quien dirige', () => {
    expect(itemEntity(item('movies', { facets: { collection: 'Harry Potter - Colección' } }))).toBe('Harry Potter')
    expect(itemEntity(item('movies', { facets: { collection: 'Colección Toy Story' } }))).toBe('Toy Story')
    expect(itemEntity(item('movies', { details: { director: 'Christopher Nolan' } }))).toBe('Christopher Nolan')
  })

  it('videojuegos: el estudio; libros: la autoría', () => {
    expect(itemEntity(item('games', { details: { developers: ['Nintendo EPD'] } }))).toBe('Nintendo EPD')
    expect(itemEntity(item('games', { facets: { companies: ['Nintendo'] } }))).toBe('Nintendo')
    expect(itemEntity(item('books', { subtitle: 'Sarah J. Maas' }))).toBe('Sarah J. Maas')
  })

  it('sin créditos ni facetas (producción sin `pnpm facets`), usa quien firma el elemento', () => {
    expect(itemEntity(item('games', { subtitle: 'Rockstar North', details: {} }))).toBe('Rockstar North')
    expect(itemEntity(item('movies', { subtitle: 'Joel Coen, Ethan Coen' }))).toBe('Joel Coen')
  })

  it('música: el artista principal, sin invitados', () => {
    expect(itemEntity(item('music', { subtitle: 'Bad Bunny feat. Jhay Cortez' }))).toBe('Bad Bunny')
    expect(itemEntity(item('perreo', { subtitle: 'Karol G x Peso Pluma' }))).toBe('Karol G')
    expect(itemEntity(item('youtube', { subtitle: 'Malcolm X' }))).toBe('Malcolm X')
    expect(itemEntity(item('music'))).toBeNull()
  })

  it('muestra el dominio sin www', () => {
    expect(linkHost('https://www.reddit.com/r/nintendo/')).toBe('reddit.com')
  })
})
