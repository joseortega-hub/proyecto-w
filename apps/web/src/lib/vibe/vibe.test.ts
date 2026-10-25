import { describe, expect, it } from 'vitest'
import { vibeGradient, vibeHue } from './vibe-color'
import { vibeTitle } from './vibe-title'
import { levelWord } from './vibe-words'

describe('título de la vibra', () => {
  it('describe la vibra según energía y positividad', () => {
    expect(vibeTitle('music', { energy: 0.1, positivity: 0.5 }).text).toBe('Noche tranquila')
    expect(vibeTitle('music', { energy: 0.1, positivity: 0.1 }).emoji).toBe('☔')
    expect(vibeTitle('music', { energy: 0.9, positivity: 0.9 }, { diaSemana: 'viernes' }).text).toBe('Viernes con toda la energía')
  })
  it('sin día de la semana, "Hoy"; sin atributos, el centro', () => {
    expect(vibeTitle('music', { energy: 0.9, positivity: 0.9 }).text).toBe('Hoy con toda la energía')
    expect(vibeTitle('music', {}).text).toBe('Música de fondo')
  })
  it('la lluvia cambia el título tranquilo, no el bajón', () => {
    const rain = { tiempo: 'lluvia', franja: 'tarde' }
    expect(vibeTitle('music', { energy: 0.1, positivity: 0.6 }, rain).text).toBe('Lluvia y cascos puestos')
    expect(vibeTitle('music', { energy: 0.1, positivity: 0.1 }, rain).text).toBe('Tarde de nostalgia')
  })
  it('funciona en las 6 temáticas (los personales usan el de música)', () => {
    for (const d of ['music', 'games', 'movies', 'books', 'youtube', 'folder']) {
      const t = vibeTitle(d, { energy: 0.5, intensity: 0.5, pace: 0.5, lightness: 0.5, mood: 0.5, positivity: 0.5 })
      expect(t.emoji.length).toBeGreaterThan(0)
      expect(t.text.length).toBeGreaterThan(3)
    }
    expect(vibeTitle('youtube', { energy: 0.1, positivity: 0.5 }).text).toBe(vibeTitle('music', { energy: 0.1, positivity: 0.5 }).text)
  })
  it('línea de contexto', () => {
    expect(vibeTitle('music', {}, { franja: 'noche', diaSemana: 'sábado', tiempo: 'lloviendo' }).context).toBe('Noche de sábado · lloviendo')
    expect(vibeTitle('music', {}).context).toBeNull()
  })
})

describe('degradado de la vibra', () => {
  it('la tinta llega a AA en toda la cuadrícula, extremos incluidos', () => {
    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        expect(vibeGradient(i / 10, j / 10).contrast).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
  it('el tono sigue a la positividad y el croma a la intensidad', () => {
    expect(vibeHue(0)).toBe(260)
    expect(vibeHue(1)).toBe(50)
    expect(vibeGradient(0.5, 0).from).not.toBe(vibeGradient(0.5, 1).from)
    expect(vibeGradient(0, 0.5).from).not.toBe(vibeGradient(1, 0.5).from)
    expect(vibeGradient(0.5, 0.5).css).toMatch(/^linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/)
  })
})

describe('palabras', () => {
  const a = { lowLabel: 'tranquila', highLabel: 'enérgica' }
  it('cinco tramos, "muy" solo con una palabra', () => {
    expect(levelWord(0.05, a)).toBe('muy tranquila')
    expect(levelWord(0.3, a)).toBe('tranquila')
    expect(levelWord(0.5, a)).toBe('término medio')
    expect(levelWord(0.7, a)).toBe('enérgica')
    expect(levelWord(0.95, a)).toBe('muy enérgica')
    expect(levelWord(0.05, { lowLabel: 'para escuchar quieto' })).toBe('para escuchar quieto')
  })
})
