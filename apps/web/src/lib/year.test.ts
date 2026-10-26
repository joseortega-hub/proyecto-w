import { describe, expect, it } from 'vitest'
import type { YearSummary } from './api'
import { cardAlt } from './year'

const summary: YearSummary = {
  year: 2026,
  empty: false,
  totals: { sessions: 3, recommended: 36, seen: 4, rated: 3, domains: 2 },
  domains: [{ id: 'movies', name: 'Películas', sessions: 2, seen: 3 }],
  topRated: [{ domainId: 'movies', title: 'Arrival', subtitle: 'Denis Villeneuve', imageUrl: null, rating: 'loved' }],
  creators: [{ domainId: 'movies', name: 'Denis Villeneuve', count: 2 }],
  words: [{ word: 'Marvel', count: 2 }],
  vibe: { domainId: 'movies', name: 'Películas', sessions: 2, bars: [{ key: 'pace', label: 'Ritmo', value: 0.8, word: 'trepidante' }] },
  facts: ['Tu mejor racha: 3 días seguidos'],
}

describe('Tu año en Sintonía', () => {
  it('describe cada tarjeta en palabras para lectores de pantalla', () => {
    expect(cardAlt('intro', summary, 'Tu año')).toBe('Tu año. 3 entrevistas, 36 recomendaciones y 4 ya vistos.')
    expect(cardAlt('rated', summary, 'Lo mejor')).toBe('Lo mejor. Arrival (me encantó)')
    expect(cardAlt('vibe', summary, 'Tu vibra')).toBe('Tu vibra. Ritmo: trepidante')
  })
})
