import { moviesDomain } from '../domains/movies.domain.js';
import { musicDomain } from '../domains/music.domain.js';
import { cueMoods } from './text-cues.js';

describe('ánimo por reglas (respaldo sin IA)', () => {
  it('"algo para entrenar" → energía alta', () => {
    expect(cueMoods('music', 'algo para entrenar', musicDomain.config)).toEqual([{ key: 'energy', level: 'high', confidence: 0.7 }]);
  });
  it('"para estudiar sin letra" → concentración alta y sin voz', () => {
    const moods = cueMoods('music', 'algo para estudiar sin letra', musicDomain.config);
    expect(moods).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'focus', level: 'high' }), expect.objectContaining({ key: 'vocal', level: 'low' })]));
  });
  it('lo negado no cuenta ("no quiero reírme")', () => {
    expect(cueMoods('movies', 'no reirme, algo serio', moviesDomain.config)).toEqual([]);
  });
});
