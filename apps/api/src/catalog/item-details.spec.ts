import { describe, expect, it } from 'vitest';
import { bookDetails, gameDetails, movieDetails } from './item-details.js';
import { parseRecording } from './musicbrainz.js';

describe('datos frikis', () => {
  it('película: director, 4 del reparto por orden, año, duración y nota', () => {
    const d = movieDetails({
      release_date: '2014-07-30',
      runtime: 121,
      vote_average: 7.9123,
      vote_count: 24000,
      credits: {
        crew: [{ job: 'Producer', name: 'Kevin Feige' }, { job: 'Director', name: 'James Gunn' }],
        cast: [5, 1, 0, 2, 3, 4].map((order) => ({ name: `Actor ${order}`, order })),
      },
    });
    expect(d).toEqual({ director: 'James Gunn', cast: ['Actor 0', 'Actor 1', 'Actor 2', 'Actor 3'], year: 2014, runtimeMin: 121, rating: 7.9 });
  });

  it('lo que la fuente no trae no se guarda', () => {
    expect(movieDetails({ vote_count: 3, vote_average: 9 })).toEqual({});
    expect(gameDetails({ released: null, metacritic: null })).toEqual({});
    expect(bookDetails({})).toEqual({});
  });

  it('videojuego y libro', () => {
    expect(
      gameDetails({ released: '2017-02-24', metacritic: 91, developers: [{ name: 'Team Cherry' }], platforms: [{ platform: { name: 'PC' } }] }),
    ).toMatchObject({ developers: ['Team Cherry'], year: 2017, metacritic: 91, platforms: ['PC'] });
    expect(bookDetails({ author_name: ['Frank Herbert'], first_publish_year: 1965, number_of_pages_median: 412, subject: ['Dune', 'x'.repeat(40)] })).toEqual({
      authors: ['Frank Herbert'], year: 1965, pages: 412, subjects: ['Dune'],
    });
  });

  it('MusicBrainz: productores, autoría, colaboraciones y álbum', () => {
    const d = parseRecording(
      {
        id: 'x',
        title: 'Tití Me Preguntó',
        'artist-credit': [{ name: 'Bad Bunny', joinphrase: ' feat. ', artist: { name: 'Bad Bunny' } }, { name: 'Jhay Cortez', artist: { name: 'Jhay Cortez' } }],
        releases: [{ title: 'Un Verano Sin Ti', date: '2022-05-06', status: 'Official' }],
        relations: [
          { type: 'producer', artist: { name: 'Tainy' } },
          { type: 'performance', work: { relations: [{ type: 'composer', artist: { name: 'Benito Martínez' } }, { type: 'lyricist', artist: { name: 'Benito Martínez' } }] } },
        ],
      },
      'Bad Bunny',
    );
    expect(d).toEqual({ producers: ['Tainy'], composers: ['Benito Martínez'], lyricists: ['Benito Martínez'], featured: ['Jhay Cortez'], album: 'Un Verano Sin Ti', year: 2022 });
  });
});
