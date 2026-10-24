import { describe, expect, it } from 'vitest';
import { artistFacets, cityParts, eraOf, filterArtists, type ArtistSummary } from './perreo.filters.js';
import { interleave } from './perreo.service.js';
import { cleanTitle, fameFromListeners, matchSimilar, parseFeed, songKey } from './perreo.sources.js';

const artist = (over: Partial<ArtistSummary>): ArtistSummary => ({
  slug: 'a', name: 'A', country: 'Puerto Rico', city: 'San Juan', countries: ['Puerto Rico'], debutYear: 2010, fame: 50, styles: ['perreo'], labels: [], ...over,
});
const list = [
  artist({ slug: 'wisin', name: 'Wisin', debutYear: 1998, fame: 80, styles: ['old school', 'perreo'], labels: ['Sony Music Latin'] }),
  artist({ slug: 'feid', name: 'Feid', country: 'Colombia', countries: ['Colombia'], city: 'Medellín, Antioquia', debutYear: 2011, fame: 95, styles: ['romántico'] }),
  artist({ slug: 'nicky', name: 'Nicky Jam', countries: ['Puerto Rico', 'Estados Unidos'], city: 'San Juan / Lawrence, Massachusetts', debutYear: 1995, fame: 70 }),
  artist({ slug: 'dei-v', name: 'Dei V', debutYear: 2020, fame: 5, styles: ['trap'] }),
];

describe('explorador de artistas', () => {
  it('ordena por fama, antigüedad y nombre', () => {
    expect(filterArtists(list, { sort: 'fame' }).map((a) => a.slug)).toEqual(['feid', 'wisin', 'nicky', 'dei-v']);
    expect(filterArtists(list, { sort: 'age' }).map((a) => a.slug)).toEqual(['nicky', 'wisin', 'feid', 'dei-v']);
    expect(filterArtists(list, { sort: 'name' }).map((a) => a.slug)).toEqual(['dei-v', 'feid', 'nicky', 'wisin']);
  });

  it('combina filtros: fama, país, época, sello y estilo a la vez', () => {
    expect(filterArtists(list, { fameMin: 60, fameMax: 90 }).map((a) => a.slug)).toEqual(['wisin', 'nicky']);
    expect(filterArtists(list, { country: 'estados unidos' }).map((a) => a.slug)).toEqual(['nicky']);
    expect(filterArtists(list, { era: 'old-school', style: 'perreo' }).map((a) => a.slug)).toEqual(['wisin', 'nicky']);
    expect(filterArtists(list, { label: 'sony music latin', country: 'Colombia' })).toEqual([]);
  });

  it('busca por nombre sin tildes ni mayúsculas y filtra por ciudad en orígenes con varias', () => {
    expect(filterArtists(list, { q: 'NÍCKY' }).map((a) => a.slug)).toEqual(['nicky']);
    expect(filterArtists(list, { city: 'lawrence' }).map((a) => a.slug)).toEqual(['nicky']);
    expect(cityParts('San Juan / Filadelfia, Pensilvania,')).toEqual(['San Juan', 'Filadelfia']);
  });

  it('las épocas salen del año de debut y las opciones cuentan artistas', () => {
    expect([1998, 2005, 2014, 2015, 2020, null].map(eraOf)).toEqual(['old-school', '2005-2014', '2005-2014', '2015-2019', '2020', null]);
    const facets = artistFacets(list);
    expect(facets.countries[0]).toEqual({ value: 'Puerto Rico', count: 3 });
    expect(facets.eras.find((e) => e.value === 'old-school')?.count).toBe(2);
    expect(facets.cities.every((c) => c.count >= 2)).toBe(true);
  });
});

describe('fuentes del importador', () => {
  it('limpia títulos de YouTube y descarta lo que no es una canción', () => {
    expect(cleanTitle('Wisin - Mi Mejor Amigo (Video Oficial)', 'Wisin')).toBe('Mi Mejor Amigo');
    expect(cleanTitle('Feid - FERXXO 100 [Official Video]', 'Feid')).toBe('FERXXO 100');
    expect(cleanTitle('Nicky Jam - El Perdón (feat. Enrique Iglesias)', 'Nicky Jam')).toBe('El Perdón (feat. Enrique Iglesias)');
    expect(cleanTitle('Entrevista exclusiva con Wisin', 'Wisin')).toBeNull();
    expect(cleanTitle('Mix de reguetón 2024', 'Wisin')).toBeNull();
  });

  it('compara títulos sin tildes, signos ni paréntesis', () => {
    expect(songKey('Dákiti (Remix)')).toBe(songKey('dakiti'));
  });

  it('lee el RSS de un canal', () => {
    const xml = '<feed><entry><yt:videoId>abc123</yt:videoId><title>Wisin &amp; Yandel - Rakata</title><published>2024-01-02T00:00:00+00:00</published></entry><entry><title>sin id</title></entry></feed>';
    expect(parseFeed(xml)).toEqual([{ id: 'abc123', title: 'Wisin & Yandel - Rakata', publishedAt: '2024-01-02T00:00:00+00:00' }]);
  });

  it('la fama es el percentil de oyentes (el que más, 100; sin datos, 0)', () => {
    expect(fameFromListeners([100, 500, null, 1000, 0])).toEqual([0, 50, 0, 100, 0]);
    expect(fameFromListeners([5])).toEqual([0]);
  });

  it('los parecidos de Last.fm se quedan solo si están entre los 66, sin repetir ni a sí mismo', () => {
    const slugs = new Map([['wisin', 'wisin'], ['yandel', 'yandel'], ['don omar', 'don-omar']]);
    expect(matchSimilar(['Yandel', 'Don Omar', 'Yandel', 'Wisin', 'Alguien Desconocido'], slugs, 'wisin')).toEqual(['yandel', 'don-omar']);
  });
});

describe('primera lista', () => {
  it('reparte las canciones ajenas por turnos entre sus artistas', () => {
    const s = (id: string, artistSlug: string) => ({ id, facets: { artist: artistSlug } });
    const out = interleave([s('1', 'a'), s('2', 'a'), s('3', 'b'), s('4', 'b'), s('5', 'c')], 4);
    expect(out.map((x) => x.id)).toEqual(['1', '3', '5', '2']);
  });
});
