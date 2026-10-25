import { booksDomain } from '../domains/books.domain.js';
import { gamesDomain } from '../domains/games.domain.js';
import { moviesDomain } from '../domains/movies.domain.js';
import { meetsAny, type MatchableItem } from './catalog-match.js';
import { detectMentions, nameQueries, resolveName, similarity } from './named.js';

let n = 0;
const item = (title: string, subtitle: string | null, facets: MatchableItem['facets'] = {}): MatchableItem => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  title,
  subtitle,
  tags: [],
  facets,
});

describe('menciones explícitas', () => {
  const names = (text: string, domain: string) => detectMentions(text, domain).map((m) => [m.name, m.role]);
  it('autores, directores, actores, sagas y estudios', () => {
    expect(names('libros de la autora saran j maas', 'books')).toEqual([['saran j maas', 'person']]);
    expect(names('algo del autor Brandon Sanderson, que sea épico', 'books')).toEqual([['Brandon Sanderson', 'person']]);
    expect(names('películas del director nolan', 'movies')).toEqual([['nolan', 'person']]);
    expect(names('una peli con Brad Pitt para reír', 'movies')).toEqual([['Brad Pitt', 'person']]);
    expect(names('quiero algo de la saga zelda', 'games')).toEqual([['zelda', 'saga']]);
    expect(names('juegos de nintendo', 'games')).toEqual([['nintendo', 'any']]);
    expect(names('libros de la editorial Alfaguara', 'books')).toEqual([['Alfaguara', 'company']]);
  });
  it('lo que queda del texto es para la IA', () => {
    expect(detectMentions('películas del director nolan para ver esta noche tranquilo', 'movies')[0].rest.trim()).toContain('esta noche');
  });
  it('géneros y frases vagas no son nombres', () => {
    expect(names('libros de terror', 'books')).toEqual([]);
    expect(names('una peli con algo de humor', 'movies')).toEqual([]);
    expect(names('juegos de aventuras', 'games')).toEqual([]);
  });
});

describe('nombres con errata', () => {
  it('semejanza', () => {
    expect(similarity('saran j maas', 'Sarah J. Maas')).toBeGreaterThan(0.7);
    expect(similarity('nolan', 'Christopher Nolan')).toBeGreaterThan(0.9);
    expect(similarity('pepe', 'Sarah J. Maas')).toBeLessThan(0.3);
    expect(nameQueries('saran j maas')).toContain('maas');
  });
  const books = [
    item('Una corte de rosas y espinas', 'Sarah J. Maas'),
    item('Trono de cristal', 'Sarah J. Maas'),
    item('El camino de los reyes', 'Brandon Sanderson'),
    item('Nacidos de la bruma', 'Brandon Sanderson'),
  ];
  it('"saran j maas" → Sarah J. Maas, solo sus libros', () => {
    const r = resolveName({ name: 'saran j maas', role: 'person' }, books, booksDomain.config)!;
    expect(r.name).toBe('Sarah J. Maas');
    expect(r.similarity).toBeLessThan(1);
    expect(books.filter((b) => meetsAny(b, r.conditions)).map((b) => b.title)).toEqual(['Una corte de rosas y espinas', 'Trono de cristal']);
  });
  it('"brandon sanderzon" → Brandon Sanderson', () => {
    expect(resolveName({ name: 'brandon sanderzon', role: 'any' }, books, booksDomain.config)?.name).toBe('Brandon Sanderson');
  });
  it('apellido suelto: "nolan" → Christopher Nolan', () => {
    const movies = [item('Origen', 'Christopher Nolan'), item('Interstellar', 'Christopher Nolan'), item('Titanic', 'James Cameron')];
    expect(resolveName({ name: 'nolan', role: 'person' }, movies, moviesDomain.config)?.name).toBe('Christopher Nolan');
  });
  it('estudio y desarrolladora: "nintendo" → compañía; nada parecido → null', () => {
    const games = [item('Zelda', null, { companies: ['Nintendo', 'Nintendo EPD'] }), item('Celeste', null, { companies: ['Maddy Makes Games'] })];
    expect(resolveName({ name: 'nintendo', role: 'any' }, games, gamesDomain.config)?.kind).toBe('studio');
    expect(resolveName({ name: 'zzzzqx', role: 'any' }, games, gamesDomain.config)).toBeNull();
  });
});
