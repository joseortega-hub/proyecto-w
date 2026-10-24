import { describe, expect, it } from 'vitest';
import type { DomainConfig } from '../domains/domain.types.js';
import type { InterviewContext } from '../interview/interview.context.js';
import { comboSlots, comboTitle, contextProfile, momentPhrase, pickStable } from './combo.js';

const config = {
  attributes: [
    { key: 'energy', kind: 'scale' },
    { key: 'positivity', kind: 'scale' },
    { key: 'genres', kind: 'tags' },
  ],
  tagGroups: [{ key: 'calm', tags: ['jazz'] }],
} as unknown as DomainConfig;

const rainyNight: InterviewContext = { franja: 'noche', diaSemana: 'sábado', finDeSemana: true, tiempo: { descripcion: 'lluvia', temperaturaC: 14 } };
const sunnyMorning: InterviewContext = { franja: 'mañana', diaSemana: 'lunes', finDeSemana: false, tiempo: { descripcion: 'despejado', temperaturaC: 22 } };

describe('combo de esta noche', () => {
  it('una noche de lluvia pide calma y menos luz que una mañana despejada', () => {
    const night = contextProfile(rainyNight, config);
    const day = contextProfile(sunnyMorning, config);
    expect(night.scales.energy).toBeLessThan(day.scales.energy);
    expect(night.scales.positivity).toBeLessThan(day.scales.positivity);
  });

  it('sábado noche: película ahora, música después y juego para mañana', () => {
    const slots = comboSlots(rainyNight, ['music', 'games', 'movies', 'books']);
    expect(slots.map((s) => [s.domainId, s.role])).toEqual([
      ['movies', 'para ahora'],
      ['music', 'para después'],
      ['games', 'para mañana'],
    ]);
  });

  it('usa Mi YouTube en el hueco de música y se salta lo que no hay', () => {
    const slots = comboSlots(rainyNight, ['music', 'youtube', 'movies']);
    expect(slots.map((s) => s.domainId)).toEqual(['movies', 'youtube']);
  });

  it('entre semana el juego es para el finde', () => {
    const slots = comboSlots({ ...rainyNight, diaSemana: 'martes', finDeSemana: false }, ['movies', 'music', 'games']);
    expect(slots.at(-1)?.role).toBe('para el finde');
  });

  it('frase y título del momento', () => {
    expect(momentPhrase(rainyNight)).toBe('noche de sábado con lluvia');
    expect(comboTitle(rainyNight)).toBe('El combo de esta noche');
  });

  it('la elección es estable para la misma semilla', () => {
    const ranked = Array.from({ length: 10 }, (_, i) => ({ id: `i${i}` }));
    expect(pickStable(ranked, 2, '2026-10-24')).toEqual(pickStable(ranked, 2, '2026-10-24'));
    expect(pickStable(ranked, 2, 'a')).toHaveLength(2);
  });
});
