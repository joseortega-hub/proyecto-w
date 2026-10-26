import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  goodreadsRating,
  HistoryFormatError,
  letterboxdRating,
  matchEntry,
  normalizeTitle,
  parseCsv,
  parseGoodreads,
  parseLetterboxd,
  parseSteamProfile,
  steamEntries,
  steamRating,
} from './history.js';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, '../../test/fixtures/history', name), 'utf8');

describe('importar historial', () => {
  it('lee CSV con comillas, comas y saltos de línea dentro', () => {
    expect(parseCsv('a,b\r\n"x, y","di ""hola""\notra"\n')).toEqual([['a', 'b'], ['x, y', 'di "hola"\notra']]);
  });

  it('convierte las notas a «me encantó / bien / meh»', () => {
    expect([5, 4.5, 4, 3, 2.5, 0.5, 0].map(letterboxdRating)).toEqual(['loved', 'loved', 'liked', 'liked', 'meh', 'meh', null]);
    expect([5, 4, 3, 2, 1, 0].map(goodreadsRating)).toEqual(['loved', 'liked', 'liked', 'meh', 'meh', null]);
    expect([60 * 60, 12 * 60, 30].map(steamRating)).toEqual(['loved', 'liked', null]);
  });

  it('Letterboxd: título, año y nota', () => {
    const entries = parseLetterboxd(fixture('letterboxd-ratings.csv'));
    expect(entries).toHaveLength(5);
    expect(entries[0]).toEqual({ title: 'Arrival', year: 2016, rating: 'loved' });
    expect(entries[1].title).toBe('Crouching Tiger, Hidden Dragon');
    expect(entries[2].rating).toBe('meh');
    expect(entries[3]).toEqual({ title: 'Amélie', year: 2001, rating: null });
  });

  it('Goodreads: solo lo leído, con autor y año original', () => {
    const entries = parseGoodreads(fixture('goodreads_library_export.csv'));
    expect(entries.map((e) => e.title)).toEqual(['Dune (Dune, #1)', 'Rayuela', 'Twilight (The Twilight Saga #1)']);
    expect(entries[0]).toMatchObject({ author: 'Frank Herbert', year: 1965, rating: 'loved' });
  });

  it('rechaza un CSV que no es de la fuente', () => {
    expect(() => parseLetterboxd(fixture('goodreads_library_export.csv'))).toThrow(HistoryFormatError);
    expect(() => parseGoodreads('a,b\n1,2')).toThrow(HistoryFormatError);
  });

  it('Steam: perfil por número, URL o nombre, y solo juegos con al menos una hora', () => {
    expect(parseSteamProfile('https://steamcommunity.com/profiles/76561197960287930/')).toEqual({ steamId: '76561197960287930' });
    expect(parseSteamProfile('https://steamcommunity.com/id/gabelogannewell')).toEqual({ vanity: 'gabelogannewell' });
    expect(parseSteamProfile('mi nombre con espacios')).toBeNull();
    const entries = steamEntries([
      { appid: 1, name: 'Hades', playtime_forever: 3200 },
      { appid: 2, name: 'Sin jugar', playtime_forever: 10 },
      { appid: 3, name: 'Portal 2', playtime_forever: 700 },
    ]);
    expect(entries).toEqual([
      { title: 'Hades', rating: 'loved' },
      { title: 'Portal 2', rating: 'liked' },
    ]);
  });

  it('empareja por título normalizado, año ±1, autor y título sin serie ni subtítulo', () => {
    expect(normalizeTitle('Dune (Dune, #1)')).toBe('dune');
    const catalog = [
      { id: 'dune', title: 'Dune', subtitle: 'Frank Herbert', year: 1965 },
      { id: 'dune-film', title: 'Dune', subtitle: 'Denis Villeneuve', year: 2021 },
      { id: 'amelie', title: 'Amélie', subtitle: 'Jean-Pierre Jeunet', year: 2001, alternates: ['Le Fabuleux Destin d’Amélie Poulain'] },
      { id: 'tiger', title: 'Tigre y dragón', subtitle: 'Ang Lee', year: 2000, alternates: ['Crouching Tiger, Hidden Dragon'] },
      { id: 'zelda', title: 'The Legend of Zelda: Breath of the Wild', subtitle: 'Nintendo', year: 2017 },
    ];
    expect(matchEntry({ title: 'Dune (Dune, #1)', author: 'Frank Herbert', rating: null }, catalog)).toBe('dune');
    expect(matchEntry({ title: 'Dune', year: 2021, rating: null }, catalog)).toBe('dune-film');
    expect(matchEntry({ title: 'amelie', year: 2002, rating: null }, catalog)).toBe('amelie');
    expect(matchEntry({ title: 'Crouching Tiger, Hidden Dragon', year: 2000, rating: null }, catalog)).toBe('tiger');
    expect(matchEntry({ title: 'Legend of Zelda: Breath of the Wild™', rating: null }, catalog)).toBe('zelda');
    expect(matchEntry({ title: 'Dune', author: 'Kevin J. Anderson', rating: null }, catalog)).toBeNull();
    expect(matchEntry({ title: 'Una película inventada', year: 2031, rating: null }, catalog)).toBeNull();
  });
});
