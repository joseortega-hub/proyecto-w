import { moviesDomain } from '../domains/movies.domain.js';
import { normalize } from './interview.engine.js';
import { answerFromText, NONSENSE, replySummary } from './reply.js';

describe('respuesta libre', () => {
  it('sí o no por cómo empieza', () => {
    expect(answerFromText('No, más romántico')).toBe('no');
    expect(answerFromText('sí, pero algo corto')).toBe('yes');
    expect(answerFromText('más romántico')).toBeUndefined();
  });

  it('"eso no tiene sentido" descarta lo último', () => {
    expect(NONSENSE.test(normalize('Eso no tiene sentido'))).toBe(true);
    expect(NONSENSE.test(normalize('no me has entendido'))).toBe(true);
    expect(NONSENSE.test(normalize('algo con sentido del humor'))).toBe(false);
  });

  it('resume lo entendido en una línea, sin el texto', () => {
    const summary = replySummary(
      { moods: [{ key: 'romance', level: 'high', confidence: 0.9 }], anchors: [], preferences: {}, exclusions: ['horror'] },
      'no',
      moviesDomain.config,
    );
    expect(summary).toBe('más romántica y nada de terror');
    expect(replySummary({ moods: [], anchors: [], preferences: {}, exclusions: [] }, 'yes', moviesDomain.config)).toBe('eso es un sí');
  });
});
