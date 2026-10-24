import { describe, expect, it } from 'vitest'
import { contrast } from '@sintonia/tokens/engine'
import { greetingGradient, greetingLine, localContext } from './greeting'
import { hashPhrase, matchSecretPhrase, normalizePhrase } from './secret-phrases'
import { buildCalendar, currentStreak, dayKey } from './story'
import type { StoryDay } from './home-types'

const rainyNight = { franja: 'noche', diaSemana: 'sábado', finDeSemana: true, tiempo: { descripcion: 'lluvia', temperaturaC: 14 } } as const

describe('saludo de Hoy para ti', () => {
  it('compone la línea con el contexto', () => {
    expect(greetingLine(rainyNight)).toBe('Buenas noches · sábado · 14 °C y llueve')
    expect(greetingLine({ franja: 'mañana', diaSemana: 'lunes' })).toBe('Buenos días · lunes')
  })

  it('el contexto local da franja y día sin red', () => {
    const c = localContext(new Date(2026, 9, 24, 21, 30))
    expect(c.franja).toBe('noche')
    expect(c.diaSemana).toBe('sábado')
    expect(c.finDeSemana).toBe(true)
  })

  it('el degradado cambia con la hora y el tiempo y siempre llega a AA con la tinta', () => {
    const night = greetingGradient(rainyNight)
    const day = greetingGradient({ franja: 'mediodía', diaSemana: 'lunes', tiempo: { descripcion: 'despejado', temperaturaC: 25 } })
    expect(night.css).not.toBe(day.css)
    for (const g of [night, day]) {
      expect(contrast(g.ink, g.from)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(g.ink, g.to)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('gancho de frases secretas', () => {
  it('de momento ninguna frase es secreta', async () => {
    expect(await matchSecretPhrase('el matatán')).toBeNull()
  })

  it('normaliza sin tildes, signos ni mayúsculas, y el hash es estable', async () => {
    expect(normalizePhrase('¡El  Matatán!')).toBe('el matatan')
    expect(await hashPhrase('El Matatán')).toBe(await hashPhrase('  el matatan '))
    expect(await hashPhrase('a')).not.toBe(await hashPhrase('b'))
  })
})

const day = (at: Date, domainId = 'music'): StoryDay => ({
  id: at.toISOString(),
  domainId,
  at: at.toISOString(),
  title: 'Lista',
  scales: { energy: 0.2, positivity: 0.3 },
  context: { franja: 'noche', diaSemana: 'sábado', finDeSemana: true, tiempo: 'lluvia' },
})

describe('calendario de vibras', () => {
  const now = new Date(2026, 9, 24, 21, 0) // sábado
  it('dibuja semanas completas que acaban en la actual y no pinta el futuro', () => {
    const cells = buildCalendar([], now, 16)
    expect(cells).toHaveLength(112)
    expect(dayKey(cells[0].date)).toBe('2026-07-06') // lunes
    expect(cells.at(-1)!.future).toBe(true) // domingo 25
    expect(cells.filter((c) => c.future)).toHaveLength(1)
  })

  it('cada día lleva la vibra de su última lista, con nombre y degradado', () => {
    const morning = new Date(2026, 9, 24, 9, 0)
    const cells = buildCalendar([day(morning), day(now, 'games')], now)
    const today = cells.find((c) => c.key === '2026-10-24')!
    expect(today.count).toBe(2)
    expect(today.day?.domainId).toBe('games')
    expect(today.day?.gradient).toContain('linear-gradient')
  })

  it('cuenta la racha de días seguidos, aunque hoy aún no haya lista', () => {
    const d = (n: number) => new Date(2026, 9, 24 - n, 12)
    expect(currentStreak(buildCalendar([day(d(0)), day(d(1)), day(d(2)), day(d(4))], now))).toBe(3)
    expect(currentStreak(buildCalendar([day(d(1)), day(d(2))], now))).toBe(2)
    expect(currentStreak(buildCalendar([], now))).toBe(0)
  })
})
