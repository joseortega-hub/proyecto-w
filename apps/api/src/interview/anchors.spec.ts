import { tidyQuestion } from './interview.service.js';
import { booksDomain } from '../domains/books.domain.js';
import { gamesDomain } from '../domains/games.domain.js';
import { moviesDomain } from '../domains/movies.domain.js';
import { musicDomain } from '../domains/music.domain.js';
import {
  anchorDimensions,
  anchorMatches,
  anchorMatchesText,
  anchorMode,
  anchorNotice,
  anchorScore,
  probeDirection,
  shortReason,
  type AnchorItem,
} from './anchors.js';
import { answersProfile, hybridRank } from './interview.engine.js';
import type { Anchor, MoodProfile } from './interview.types.js';

const item = (id: string, over: Partial<AnchorItem & { facets: Record<string, string> }> = {}) => ({
  id,
  title: id,
  subtitle: null,
  description: null,
  tags: [],
  attributes: {},
  popularity: 0.5,
  facets: {},
  ...over,
});

const marvel: Anchor = { label: 'Marvel', kind: 'franchise', terms: ['marvel', 'MCU', 'Vengadores', 'Iron Man', 'Spider-Man'], required: true };
const pokemon: Anchor = { label: 'Pokémon', kind: 'franchise', terms: ['pokemon', 'pikachu'], required: true };
const sanderson: Anchor = { label: 'Brandon Sanderson', kind: 'creator', terms: ['Sanderson', 'Nacidos de la bruma'], required: true };
const badBunny: Anchor = { label: 'Bad Bunny', kind: 'creator', terms: ['bad bunny'], required: true };

const profile: MoodProfile = { scales: { humor: 0.9, pace: 0.8 }, tagGroups: {}, informed: ['humor', 'pace'], confidence: {}, summary: [] };

describe('intención explícita (anclas)', () => {
  it('encuentra el ancla en el título, las etiquetas o la descripción, sin tildes ni mayúsculas', () => {
    expect(anchorScore(item('Vengadores: Endgame'), marvel)).toBe(1);
    expect(anchorScore(item('Guardianes de la Galaxia', { tags: ['marvel cinematic universe (mcu)'] }), marvel)).toBe(0.8);
    expect(anchorScore(item('Logan', { description: 'Un viejo héroe de Marvel.' }), marvel)).toBe(0.5);
    expect(anchorScore(item('Pokémon Legends: Arceus'), pokemon)).toBe(1);
    expect(anchorScore(item('El imperio final', { subtitle: 'Brandon Sanderson' }), sanderson)).toBe(1);
  });

  it('solo cuenta palabras completas', () => {
    const thor: Anchor = { label: 'Thor', kind: 'title', terms: [], required: true };
    expect(anchorScore(item('The Author'), thor)).toBe(0);
    expect(anchorScore(item('Thor: Ragnarok'), thor)).toBe(1);
    expect(anchorMatchesText('Pokemon Snap', pokemon)).toBe(true);
    expect(anchorMatchesText('Pokerstars', pokemon)).toBe(false);
  });

  it('filtra si lo pide de forma explícita y hay de sobra; si no, sube y avisa', () => {
    expect(anchorMode([marvel], 12, 10)).toBe('filter');
    expect(anchorMode([marvel], 4, 10)).toBe('boost');
    expect(anchorMode([{ ...marvel, required: false }], 30, 10)).toBe('boost');
    expect(anchorMode([], 0, 10)).toBe('none');
    expect(anchorNotice([marvel], 4, 10, 'películas', 'f')).toBe('Solo tengo 4 de Marvel; te completo la lista con películas parecidas.');
    expect(anchorNotice([pokemon], 0, 12, 'videojuegos', 'm')).toMatch(/No tengo videojuegos de Pokémon/);
    expect(anchorNotice([marvel], 10, 10, 'películas', 'f')).toBeNull();
  });

  it('con el empujón del ancla, lo pedido sube por encima de lo que encaja mejor con el ánimo', () => {
    const fit = item('Comedia perfecta', { attributes: { humor: 0.9, pace: 0.8 } });
    const asked = item('Iron Man', { attributes: { humor: 0.4, pace: 0.5 } });
    const pool = [fit, asked, item('Otra', { attributes: { humor: 0.2, pace: 0.2 } })].map((i) => ({ item: i, semantic: null }));
    const plain = hybridRank(pool, profile, moviesDomain.config, 3);
    expect(plain[0].item.id).toBe('Comedia perfecta');
    const boosted = hybridRank(pool, profile, moviesDomain.config, 3, {
      boost: (i) => (anchorScore(i as AnchorItem, marvel) >= 0.5 ? 0.6 : 0),
    });
    expect(boosted[0].item.id).toBe('Iron Man');
  });

  it('las preguntas se centran en lo que más separa a los elementos del ancla', () => {
    const list = [
      item('a', { attributes: { humor: 0.9, pace: 0.8, mood: 0.5 } }),
      item('b', { attributes: { humor: 0.1, pace: 0.85, mood: 0.5 } }),
      item('c', { attributes: { humor: 0.5, pace: 0.8, mood: 0.55 } }),
    ];
    expect(anchorDimensions(list, moviesDomain.config)[0]).toBe('humor');
    const unwind = moviesDomain.config.probes.find((p) => p.id === 'unwind')!;
    const laugh = moviesDomain.config.probes.find((p) => p.id === 'laugh')!;
    expect(probeDirection(unwind, 'depth', moviesDomain.config)).toBe('low');
    expect(probeDirection(laugh, 'humor', moviesDomain.config)).toBe('high');
  });

  it('el "por qué" es una línea con datos concretos y cita el ancla', () => {
    const reason = shortReason(
      item('Guardianes de la Galaxia', { subtitle: 'James Gunn', tags: ['marvel'], attributes: { humor: 0.85, pace: 0.8 }, facets: { year: '2014' } }),
      { config: moviesDomain.config, profile, anchors: [marvel], likes: ['ciencia ficción y fantasía'] },
    );
    expect(reason).toBe('Es de Marvel, como pediste · dir. James Gunn (2014) · trepidante y divertida · va con tus gustos: ciencia ficción y fantasía');
    // Si el ancla es el propio creador, no se repite.
    const book = shortReason(item('El imperio final', { subtitle: 'Brandon Sanderson', facets: { year: '2006' } }), {
      config: booksDomain.config,
      profile: { ...profile, informed: [] },
      anchors: [sanderson],
      likes: [],
    });
    expect(book.startsWith('Es de Brandon Sanderson, como pediste · de 2006')).toBe(true);
  });

  it('funciona igual en todos los dominios', () => {
    const songs = [item('Tití me preguntó', { subtitle: 'Bad Bunny' }), item('Otra', { subtitle: 'Feid' })];
    expect(anchorMatches(songs, [badBunny]).map((s) => s.id)).toEqual(['Tití me preguntó']);
    const games = [item('Pokémon Rojo'), item('Zelda', { tags: ['nintendo'] })];
    expect(anchorMatches(games, [pokemon]).map((g) => g.id)).toEqual(['Pokémon Rojo']);
    expect(shortReason(songs[0], { config: musicDomain.config, profile, anchors: [badBunny], likes: [] })).toMatch(/^Es de Bad Bunny, como pediste/);
    expect(shortReason(games[0], { config: gamesDomain.config, profile, anchors: [pokemon], likes: [] })).toMatch(/^Es de Pokémon/);
  });
});

describe('perfil de respaldo sin IA', () => {
  it('cada sí o no empuja su dimensión hacia el extremo que corresponde', () => {
    const turns = [
      { probeId: 'laugh', text: '', reason: '', answer: 'yes' as const },
      { probeId: 'unwind', text: '', reason: '', answer: 'yes' as const },
      { probeId: 'romance', text: '', reason: '', answer: 'unknown' as const },
    ];
    const { scales, tagGroups } = answersProfile(turns, moviesDomain.config, { pace: { value: 0.85, confidence: 0.9 } });
    expect(scales).toMatchObject({ humor: 0.85, depth: 0.15, pace: 0.85, romance: 0.5 });
    expect(tagGroups.comedy).toBe(0.5);
  });
});

describe('preguntas enfocadas', () => {
  it('quita el formato y lo que va detrás de la interrogación', () => {
    expect(tidyQuestion('¿Buscas una tipo *Pokémon Mystery Dungeon*, con historia? Es lo que más las distingue.')).toBe(
      '¿Buscas una tipo Pokémon Mystery Dungeon, con historia?',
    );
  });
});
