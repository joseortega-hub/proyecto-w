import { gamesDomain } from '../domains/games.domain.js';
import { hybridRank, similarity } from '../interview/interview.engine.js';
import type { MoodProfile } from '../interview/interview.types.js';
import {
  applyFeedback,
  emptyTaste,
  tasteAffinity,
  tasteHints,
  tasteLabel,
  tasteOnlyProbes,
  tasteState,
  type TasteProfile,
} from './taste.engine.js';

const config = gamesDomain.config;
const neutral = { intensity: 0.5, challenge: 0.5, story: 0.5, social: 0.5, length: 0.5, lightness: 0.5 };
const game = (id: string, tags: string[], attributes: Record<string, number> = neutral) => ({
  id,
  subtitle: `estudio-${id}`,
  attributes,
  tags,
  popularity: 0.5,
});
const profile: MoodProfile = {
  scales: { ...neutral, story: 0.8 },
  tagGroups: {},
  informed: ['story'],
  confidence: {},
  summary: [],
};
const taste: TasteProfile = { likes: ['@rpg', 'open-world'], dislikes: ['@horror'], learned: {} };

describe('perfil de gustos', () => {
  it('la afinidad sube con los gustos y baja con lo que no le gusta', () => {
    expect(tasteAffinity({ tags: ['open-world', 'rpg'] }, taste, config)).toBe(0.8);
    expect(tasteAffinity({ tags: ['adventure'] }, taste, config)).toBe(0.6);
    expect(tasteAffinity({ tags: ['puzzle'] }, taste, config)).toBe(0);
    expect(tasteAffinity({ tags: ['horror', 'zombies'] }, taste, config)).toBe(-0.8);
    expect(tasteAffinity({ tags: ['rpg'] }, null, config)).toBe(0);
  });

  it('los 👍/👎 se aprenden por etiqueta, se pueden deshacer y no aprenden de etiquetas comunes', () => {
    const common = new Set(['singleplayer']);
    const up = applyFeedback({}, ['roguelike', 'singleplayer'], null, 'up', common);
    expect(up).toEqual({ roguelike: 0.15 });
    const changed = applyFeedback(up, ['roguelike', 'singleplayer'], 'up', 'down', common);
    expect(changed).toEqual({ roguelike: -0.15 });
    expect(applyFeedback(changed, ['roguelike'], 'down', null, common)).toEqual({});
    const learned = { ...emptyTaste(), learned: { roguelike: 0.9, pixel: 0.9 } };
    expect(tasteAffinity({ tags: ['roguelike', 'pixel'] }, learned, config)).toBe(0.6);
  });

  it('el ranking sube lo que encaja con los gustos sin excluir el resto', () => {
    const pool = [game('horror', ['horror', 'survival']), game('puzzle', ['puzzle']), game('rpg', ['rpg', 'open-world'])];
    const plain = hybridRank(pool.map((item) => ({ item, semantic: null })), profile, config, 3);
    expect(plain.map((c) => c.taste)).toEqual([0, 0, 0]);

    const withTaste = hybridRank(pool.map((item) => ({ item, semantic: null })), profile, config, 3, { taste });
    expect(withTaste[0].item.id).toBe('rpg');
    expect(withTaste.at(-1)?.item.id).toBe('horror');
    // No es un filtro: lo que no le gusta baja, pero sigue en la bolsa.
    expect(withTaste).toHaveLength(3);
    expect(similarity(pool[2], profile, config, taste)).toBeGreaterThan(similarity(pool[2], profile, config));
  });

  it('un buen encaje de ánimo sigue ganando a un gusto que no encaja con el ánimo', () => {
    const story = game('story', ['puzzle'], { ...neutral, story: 0.85 });
    const liked = game('liked', ['rpg'], { ...neutral, story: 0.05 });
    const pool = [story, liked].map((item) => ({ item, semantic: null }));
    expect(hybridRank(pool, profile, config, 2, { taste })[0].item.id).toBe('story');
  });

  it('los gustos van al state en palabras, y a las explicaciones', () => {
    const state = tasteState({ ...taste, learned: { roguelike: 0.3, 'sports-game': -0.45 } }, config);
    expect(state).toEqual({
      leGusta: ['rol y aventura', 'open world'],
      noLeGusta: ['terror y supervivencia'],
      leHanGustado: ['roguelike'],
      noLeHanGustado: ['sports game'],
    });
    expect(tasteState(emptyTaste(), config)).toBeNull();
    expect(tasteHints({ tags: ['adventure'] }, taste, config)).toEqual(['rol y aventura']);
    expect(tasteLabel('@cozy', config)).toBe('casuales y relajados');
  });

  it('con gustos, la entrevista se salta las preguntas que solo son de estilo', () => {
    const skip = tasteOnlyProbes(config);
    expect(skip.has('rpg')).toBe(true);
    expect(skip.has('action')).toBe(true);
    // "¿algo oscuro?" informa del tono, que es ánimo: se queda.
    expect(skip.has('dark')).toBe(false);
    expect(skip.has('story')).toBe(false);
  });
});
