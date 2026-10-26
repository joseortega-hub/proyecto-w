import { describe, expect, it } from 'vitest';
import { artistKey, buildArtistIndex, linkSongs, matchSong, songArtistNames } from './perreo.youtube.js';

const index = buildArtistIndex([
  { slug: 'bad-bunny', name: 'Bad Bunny', aliases: ['Benito'] },
  { slug: 'nengo-flow', name: 'Ñengo Flow', aliases: [] },
  { slug: 'wisin-y-yandel', name: 'Wisin & Yandel', aliases: ['Wisin y Yandel'] },
  { slug: 'wisin', name: 'Wisin', aliases: [] },
  { slug: 'yandel', name: 'Yandel', aliases: [] },
  { slug: 'feid', name: 'Feid', aliases: ['Ferxxo'] },
  { slug: 'myke-towers', name: 'Myke Towers', aliases: [] },
  { slug: 'x', name: 'X', aliases: [] },
]);

describe('artistKey', () => {
  it('quita tildes, mayúsculas, espacios y signos', () => {
    expect(artistKey('Ñengo Flow')).toBe('nengoflow');
    expect(artistKey('BadBunny')).toBe(artistKey('Bad Bunny'));
    expect(artistKey('Ca$h')).toBe('cash');
  });
});

describe('songArtistNames', () => {
  it('separa colaboraciones y lee los feat. del título', () => {
    expect(songArtistNames({ title: 'Classy 101 (feat. Myke Towers)', subtitle: 'Feid x Young Miko' })).toEqual([
      'Feid x Young Miko',
      'Feid',
      'Young Miko',
      'Myke Towers',
    ]);
  });
});

describe('matchSong', () => {
  it('empareja por nombre normalizado y alias', () => {
    expect(matchSong({ title: 'DtMF', subtitle: 'BAD BUNNY' }, index)).toEqual(['bad-bunny']);
    expect(matchSong({ title: 'Algo', subtitle: 'Nengo Flow' }, index)).toEqual(['nengo-flow']);
    expect(matchSong({ title: 'Luna', subtitle: 'Ferxxo' }, index)).toEqual(['feid']);
  });

  it('un grupo cuenta para el grupo y para cada miembro', () => {
    expect(matchSong({ title: 'Rakata', subtitle: 'Wisin y Yandel' }, index)).toEqual(['wisin-y-yandel', 'wisin', 'yandel']);
  });

  it('colaboraciones con varios artistas', () => {
    expect(matchSong({ title: 'Classy 101 (feat. Myke Towers)', subtitle: 'Feid x Bad Bunny' }, index)).toEqual(['feid', 'bad-bunny', 'myke-towers']);
    expect(matchSong({ title: 'Tema ft. Feid', subtitle: 'Myke Towers feat. Ñengo Flow' }, index)).toEqual(['myke-towers', 'nengo-flow', 'feid']);
  });

  it('sin coincidencias parciales ni nombres de una letra', () => {
    expect(matchSong({ title: 'Otra', subtitle: 'Bad Bunny Fan Club' }, index)).toEqual([]);
    expect(matchSong({ title: 'Otra', subtitle: 'X' }, index)).toEqual([]);
  });
});

describe('linkSongs', () => {
  it('agrupa por artista sin duplicar el mismo vídeo', () => {
    const songs = [
      { id: 'a', videoId: 'v1', title: 'DtMF', subtitle: 'Bad Bunny' },
      { id: 'b', videoId: 'v1', title: 'DtMF', subtitle: 'Bad Bunny' },
      { id: 'c', videoId: 'v2', title: 'Luna', subtitle: 'Feid & Bad Bunny' },
      { id: 'd', videoId: 'v3', title: 'Balada', subtitle: 'Otro' },
    ];
    const { bySlug, bySong } = linkSongs(songs, index);
    expect(bySlug.get('bad-bunny')?.map((s) => s.id)).toEqual(['a', 'c']);
    expect(bySlug.get('feid')?.map((s) => s.id)).toEqual(['c']);
    expect(bySong.has('d')).toBe(false);
  });
});
