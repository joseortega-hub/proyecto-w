import { booksDomain } from '../domains/books.domain.js';
import { gamesDomain } from '../domains/games.domain.js';
import { moviesDomain } from '../domains/movies.domain.js';
import { anchorMode, anchorScore } from './anchors.js';
import { anchorsFromEntities, findEntities, meetsAny, pickWithoutAI, type MatchableItem } from './catalog-match.js';

let n = 0;
const item = (title: string, extra: Partial<MatchableItem> = {}): MatchableItem & { description: null; attributes: Record<string, number> } => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  title,
  subtitle: null,
  tags: [],
  facets: {},
  description: null,
  attributes: {},
  ...extra,
});
const resolve = (text: string, catalog: MatchableItem[], config = moviesDomain.config) => {
  const entities = findEntities(text, catalog, config);
  return anchorsFromEntities(entities, pickWithoutAI(text, entities));
};

describe('entender contra el catálogo', () => {
  const movies = [
    item('Vengadores', { subtitle: 'Joss Whedon', facets: { companies: ['Marvel Studios'], collection: 'Los Vengadores - Colección' }, tags: ['acción'] }),
    item('Thor: el mundo oscuro', { subtitle: 'Alan Taylor', facets: { companies: ['Marvel Studios'] }, tags: ['fantasía'] }),
    item('Pretty Woman', { subtitle: 'Garry Marshall', facets: { companies: ['Touchstone Pictures'] }, tags: ['romance', 'comedia'] }),
    item('Titanic', { subtitle: 'James Cameron', facets: { companies: ['Paramount'] }, tags: ['romance', 'drama'] }),
  ];

  it('"algo de Marvel": es la productora (aunque "Vengadores" no diga Marvel) y filtra', () => {
    const [marvel] = resolve('quiero algo de Marvel y no sé el qué', movies);
    expect(marvel.label).toBe('Marvel');
    expect(marvel.required).toBe(true);
    const hits = movies.filter((m) => meetsAny(m, marvel.match!));
    expect(hits.map((m) => m.title)).toEqual(['Vengadores', 'Thor: el mundo oscuro']);
    expect(anchorMode([marvel], hits.length, 10)).toBe('filter');
  });

  it('"tipo Marvel" es una referencia, no un filtro', () => {
    const [marvel] = resolve('algo tipo Marvel', movies);
    expect(marvel.required).toBe(false);
    expect(anchorMode([marvel], 2, 10)).toBe('boost');
  });

  it('"algo romántico" casa con la etiqueta romance por la raíz', () => {
    const [romance] = resolve('quiero algo romántico', movies);
    expect(romance.kind).toBe('tag');
    expect(movies.filter((m) => meetsAny(m, romance.match!)).map((m) => m.title)).toEqual(['Pretty Woman', 'Titanic']);
    // Un género solo filtra si da para una lista.
    expect(anchorMode([romance], 2, 10)).toBe('boost');
    expect(anchorMode([romance], 12, 10)).toBe('filter');
  });

  it('lo negado no se pide ("nada de romance")', () => {
    expect(resolve('nada de romance, algo de acción', movies).map((a) => a.label)).toEqual(['Acción']);
  });

  it('"Alas de sangre y algo parecido": el título es una semilla, no un filtro', () => {
    const books = [item('Alas de Sangre', { subtitle: 'Rebecca Yarros', tags: ['fantasy', 'romance'] }), item('Trono de cristal', { subtitle: 'Sarah J. Maas', tags: ['fantasy'] })];
    const [seed] = resolve('una lista de libros con Alas de sangre y algo parecido', books, booksDomain.config);
    expect(seed.kind).toBe('title');
    expect(seed.ids).toEqual([books[0].id]);
    expect(anchorScore({ ...books[0], attributes: {}, description: null, popularity: 0 }, seed)).toBe(1);
    expect(anchorScore({ ...books[1], attributes: {}, description: null, popularity: 0 }, seed)).toBe(0);
    expect(anchorMode([seed], 1, 10)).toBe('boost');
  });

  it('una saga sin facetas sale de los títulos ("Pokémon" en 3 títulos o más)', () => {
    const games = [item('Pokémon Rojo'), item('Pokémon Oro'), item('Pokémon Espada'), item('Zelda')];
    const [pokemon] = resolve('me apetece un Pokémon', games, gamesDomain.config);
    expect(pokemon.kind).toBe('franchise');
    expect(games.filter((g) => meetsAny(g, pokemon.match!))).toHaveLength(3);
  });

  it('una autora por su apellido', () => {
    const books = [item('El imperio final', { subtitle: 'Brandon Sanderson' }), item('Elantris', { subtitle: 'Brandon Sanderson' }), item('Dune', { subtitle: 'Frank Herbert' })];
    const [author] = resolve('algo de Sanderson', books, booksDomain.config);
    expect(author.kind).toBe('creator');
    expect(books.filter((b) => meetsAny(b, author.match!))).toHaveLength(2);
  });

  it('una palabra corriente no es un título ("algo para la noche" no pide la canción "Noche")', () => {
    expect(resolve('algo tranquilo para la noche', [item('Noche'), item('Mañana')])).toEqual([]);
  });
});

describe('ediciones repetidas', () => {
  it('junta ediciones de un mismo título, pero no las secuelas', async () => {
    const { titleKey } = await import('./catalog-match.js');
    expect(titleKey('Alas de sangre (Empíreo 1)')).toBe(titleKey('Alas de Sangre'));
    expect(titleKey('Vengadores: Infinity War')).not.toBe(titleKey('Vengadores'));
  });
});

describe('etiquetas que no son géneros', () => {
  it('"marvel" como etiqueta suelta es una saga: filtra aunque haya una', () => {
    const catalog = [item('Capitana Marvel', { tags: ['acción', 'marvel'] }), item('Titanic', { tags: ['romance'] })];
    const [marvel] = resolve('algo de Marvel', catalog);
    expect(marvel.kind).toBe('franchise');
    expect(anchorMode([marvel], 1, 10)).toBe('filter');
  });
});

describe('parecido a X', () => {
  it('"parecido a X" y "X y parecidos" son referencias; solo el segundo incluye a X', async () => {
    const { likeIncludesItself, saidAsLike } = await import('./catalog-match.js');
    expect(saidAsLike('algo parecido a Marvel', 'marvel')).toBe(true);
    expect(saidAsLike('Marvel y parecidos', 'marvel')).toBe(true);
    expect(saidAsLike('algo de Marvel', 'marvel')).toBe(false);
    expect(likeIncludesItself('Marvel y parecidos', 'Marvel')).toBe(true);
    expect(likeIncludesItself('algo parecido a Marvel', 'Marvel')).toBe(false);
  });

  it('lo que deja fuera un "parecido a" no puntúa ni entra', () => {
    const marvel = item('Thor', { facets: { companies: ['Marvel Studios'] } });
    const dc = item('Batman', { facets: { companies: ['DC Films'] } });
    const anchor = { label: 'parecido a Marvel', kind: 'franchise' as const, terms: [], required: false, similar: true, match: [{ field: 'companies', values: ['dc films'] }], not: [{ field: 'companies', values: ['marvel studios'] }] };
    expect(anchorScore({ ...dc, attributes: {}, description: null, popularity: 0 }, anchor)).toBe(1);
    expect(anchorScore({ ...marvel, attributes: {}, description: null, popularity: 0 }, anchor)).toBe(0);
  });
});
