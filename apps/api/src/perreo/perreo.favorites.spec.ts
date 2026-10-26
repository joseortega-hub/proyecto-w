import { describe, expect, it } from 'vitest';
import {
  applyProfile,
  favKey,
  favoriteRanks,
  favoritesFirst,
  linkGroups,
} from './perreo.favorites.js';
import { protectManual } from './perreo.edit.js';
import { filterArtists, type ArtistSummary } from './perreo.filters.js';
import type { PerreoArtistFile } from './perreo.types.js';

const roster = [
  { slug: 'farruko', name: 'Farruko' },
  { slug: 'wisin', name: 'Wisin' },
  { slug: 'yandel', name: 'Yandel' },
  { slug: 'wisin-yandel', name: 'Wisin & Yandel' },
  { slug: 'arcangel', name: 'Arcangel' },
];

describe('favoritos: orden de prioridad', () => {
  it('«Wisin y Yandel», «Wisin & Yandel» y tildes se reconocen igual', () => {
    expect(favKey('Wisin y Yandel')).toBe(favKey('Wisin & Yandel'));
    expect(favKey('Arcángel')).toBe(favKey('Arcangel'));
  });

  it('da el puesto según el orden de la lista e ignora lo que no existe', () => {
    const ranks = favoriteRanks(
      ['Wisin', 'Yandel', 'Wisin y Yandel', 'Nadie', 'Farruko', 'Arcángel'],
      roster,
    );
    expect([...ranks.entries()]).toEqual([
      ['wisin', 1],
      ['yandel', 2],
      ['wisin-yandel', 3],
      ['farruko', 4],
      ['arcangel', 5],
    ]);
  });

  it('los scripts procesan a los favoritos primero, y el resto en su orden', () => {
    const ranks = favoriteRanks(['Yandel', 'Wisin'], roster);
    expect(
      favoritesFirst(roster, (a) => a.slug, ranks).map((a) => a.slug),
    ).toEqual(['yandel', 'wisin', 'farruko', 'wisin-yandel', 'arcangel']);
  });

  it('el explorador los pone arriba solo sin filtros', () => {
    const base = {
      country: null,
      city: null,
      countries: ['Puerto Rico'],
      debutYear: 2000,
      styles: [],
      labels: [],
      followed: false,
      kind: 'artist',
      incomplete: false,
    };
    const list: ArtistSummary[] = [
      { ...base, slug: 'bad-bunny', name: 'Bad Bunny', fame: 100 },
      { ...base, slug: 'yandel', name: 'Yandel', fame: 60, favorite: 2 },
      { ...base, slug: 'wisin', name: 'Wisin', fame: 50, favorite: 1 },
    ];
    expect(filterArtists(list, {}).map((a) => a.slug)).toEqual([
      'wisin',
      'yandel',
      'bad-bunny',
    ]);
    expect(
      filterArtists(list, { sort: 'fame', country: 'Puerto Rico' }).map(
        (a) => a.slug,
      ),
    ).toEqual(['bad-bunny', 'yandel', 'wisin']);
    expect(filterArtists(list, { sort: 'name' })[0].slug).toBe('bad-bunny');
  });
});

describe('favoritos: fusión sin pisar', () => {
  const file: PerreoArtistFile = {
    slug: 'wisin',
    name: 'Wisin',
    realName: 'Juan Luis Morera Luna',
    birthDate: null,
    country: 'Puerto Rico',
    city: null,
    countries: ['Puerto Rico'],
    debutYear: 1998,
    fame: 77,
    listeners: 1,
    styles: [],
    labels: [],
    links: { instagram: 'https://www.instagram.com/wisin' },
    bio: null,
    bioSource: null,
    youtubeChannelId: null,
    similar: [],
    hasPhoto: false,
  };

  it('solo rellena huecos y suma redes que faltan', () => {
    const out = applyProfile(file, {
      realName: 'Otro nombre',
      birthDate: '1978-12-19',
      origin: 'Cayey',
      activeFrom: 1996,
      labels: ['La Base Music'],
      socials: {
        instagram: 'https://www.instagram.com/otro',
        x: 'https://x.com/WisinOficial',
      },
      channelId: 'UC123',
      awards: ['Grammy Latino'],
    });
    expect(out.realName).toBe('Juan Luis Morera Luna');
    expect(out.debutYear).toBe(1998);
    expect(out.birthDate).toBe('1978-12-19');
    expect(out.city).toBe('Cayey');
    expect(out.labels).toEqual([
      { name: 'La Base Music', start: null, end: null },
    ]);
    expect(out.links).toEqual({
      instagram: 'https://www.instagram.com/wisin',
      x: 'https://x.com/WisinOficial',
    });
    expect(out.youtubeChannelId).toBe('UC123');
    expect(out.profile?.awards).toEqual(['Grammy Latino']);
  });

  it('lo editado a mano (manual_fields) no llega a la BD aunque la ficha lo traiga', () => {
    const out = applyProfile(file, {
      birthDate: '1978-12-19',
      labels: ['La Base Music'],
    });
    const set = protectManual({ ...out, favoriteRank: 1 }, [
      'birthDate',
      'labels',
    ]);
    expect(set).not.toHaveProperty('birthDate');
    expect(set).not.toHaveProperty('labels');
    expect(set.favoriteRank).toBe(1);
    expect(set.profile).toBeDefined();
  });
});

describe('favoritos: grupo ↔ miembros', () => {
  it('enlaza el dúo con sus miembros en los dos sentidos', () => {
    const links = linkGroups(
      { 'wisin-yandel': ['Wisin', 'Yandel', 'Alguien de fuera'] },
      roster,
    );
    expect(links['wisin-yandel']).toEqual({ members: ['wisin', 'yandel'] });
    expect(links.wisin).toEqual({ memberOf: ['wisin-yandel'] });
    expect(links.yandel).toEqual({ memberOf: ['wisin-yandel'] });
  });

  it('sin miembros conocidos no inventa nada', () => {
    expect(linkGroups({ farruko: ['Otro'] }, roster)).toEqual({});
  });
});
