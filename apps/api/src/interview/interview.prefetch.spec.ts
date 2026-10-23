import { NextQuestionPrefetch } from './interview.prefetch.js';
import type { InterviewTurn } from './interview.types.js';

const turns = (probeId: string): InterviewTurn[] => [{ probeId, text: '', reason: '', answer: null }];

describe('precarga de la siguiente pregunta', () => {
  it('entrega la precarga de la respuesta que llega y descarta las demás', async () => {
    const cache = new NextQuestionPrefetch();
    cache.start('s1', 2, 'yes', async () => turns('dance'));
    cache.start('s1', 2, 'no', async () => turns('calm'));
    expect(await cache.take('s1', 2, 'no')).toEqual(turns('calm'));
    expect(cache.take('s1', 2, 'yes')).toBeNull();
  });

  it('no sirve una precarga de otro punto de la entrevista', () => {
    const cache = new NextQuestionPrefetch();
    cache.start('s1', 2, 'yes', async () => turns('dance'));
    expect(cache.take('s1', 3, 'yes')).toBeNull();
  });

  it('una precarga que falla no rompe nada: simplemente no se encuentra', async () => {
    const cache = new NextQuestionPrefetch();
    cache.start('s1', 0, 'yes', () => Promise.reject(new Error('503')));
    await new Promise((r) => setTimeout(r, 0));
    expect(cache.take('s1', 0, 'yes')).toBeNull();
  });
});
