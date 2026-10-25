import { describe, expect, it } from 'vitest';
import { artistFacets, cityParts, eraOf, filterArtists, type ArtistSummary } from './perreo.filters.js';
import { interleave } from './perreo.service.js';
import { stylesFromTags, accountHash, classify, findDuplicate, freeSlug, mergePerreo } from './perreo.resolve.js';
import type { PerreoArtistFile } from './perreo.types.js';
import { hasSongs, kindFromMusicBrainz, kindFromUsername, kindFromWikidata } from './perreo.kinds.js';
import { cleanTitle, fameFromListeners, matchSimilar, parseFeed, songKey } from './perreo.sources.js';

const artist = (over: Partial<ArtistSummary>): ArtistSummary => ({
  slug: 'a', name: 'A', country: 'Puerto Rico', city: 'San Juan', countries: ['Puerto Rico'], debutYear: 2010, fame: 50, styles: ['perreo'], labels: [], followed: false, kind: 'artist', incomplete: false, ...over,
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

describe('segunda pasada de Instagram', () => {
  const urban = ['reggaeton', 'latin'];
  it('acepta con seguridad si el enlace de Instagram coincide, aunque el género no sea urbano', () => {
    expect(classify('x', { name: 'Otro Nombre', listeners: 10, tags: ['rock'], linkMatch: true })?.kind).toBe('sure');
  });
  it('acepta nombre exacto + género urbano + oyentes, aunque el usuario lleve «oficial» o signos', () => {
    expect(classify('jbalvin', { name: 'J Balvin', listeners: 4_000_000, tags: urban })?.kind).toBe('sure');
    expect(classify('el.alfa_oficial', { name: 'El Alfa', listeners: 900_000, tags: ['dembow'] })?.kind).toBe('sure');
    expect(classify('alvaro.diaz', { name: 'Álvaro Díaz', listeners: 5000, tags: ['trap latino'] })?.kind).toBe('sure');
  });
  it('manda a revisar el nombre exacto sin género claro o con pocos oyentes', () => {
    expect(classify('luna', { name: 'Luna', listeners: 80_000, tags: ['indie'] })?.kind).toBe('review');
    expect(classify('dei.v', { name: 'Dei V', listeners: 1500, tags: urban })?.kind).toBe('review');
  });
  it('manda a revisar un nombre parecido solo con género urbano y muchos oyentes', () => {
    expect(classify('mikelatinoficial', { name: 'Mike Latin Boy', listeners: 90_000, tags: urban })?.kind).toBe('review');
    expect(classify('mikelatinoficial', { name: 'Mike Latin Boy', listeners: 90_000, tags: ['rock'] })).toBeNull();
  });
  it('descarta lo que no cuadra: otro nombre, namesake diminuto', () => {
    expect(classify('panaderia_lola', { name: 'Lola', listeners: 2_000_000, tags: urban })).toBeNull();
    expect(classify('luna', { name: 'Luna', listeners: 200, tags: urban })).toBeNull();
  });
  it('no guarda el nombre de las cuentas vistas, solo un hash estable', () => {
    expect(accountHash('Wisin')).toBe(accountHash('wisin'));
    expect(accountHash('wisin')).not.toContain('wisin');
  });
});

describe('emparejado y duplicados', () => {
  const known = [
    { slug: 'wisin', name: 'Wisin', qid: 'Q1' },
    { slug: 'jay-wheeler', name: 'Jay Wheeler', qid: null, mbid: 'mb-1' },
  ];
  it('empareja por Wikidata, MBID o nombre normalizado', () => {
    expect(findDuplicate({ name: 'Otro', qid: 'Q1' }, known)?.slug).toBe('wisin');
    expect(findDuplicate({ name: 'Otro', mbid: 'mb-1' }, known)?.slug).toBe('jay-wheeler');
    expect(findDuplicate({ name: 'WISÍN' }, known)?.slug).toBe('wisin');
    expect(findDuplicate({ name: 'Jay  Wheeler.' }, known)?.slug).toBe('jay-wheeler');
    expect(findDuplicate({ name: 'Feid', qid: 'Q9' }, known)).toBeUndefined();
  });
  it('el slug nunca choca', () => {
    expect(freeSlug('Álvaro Díaz', new Set())).toBe('alvaro-diaz');
    expect(freeSlug('Álvaro Díaz', new Set(['alvaro-diaz']))).toBe('alvaro-diaz-2');
  });
  const file = (o: Partial<PerreoArtistFile>): PerreoArtistFile => ({
    slug: 'a', name: 'A', realName: null, birthDate: null, country: null, city: null, countries: [], debutYear: null, fame: 0, listeners: null,
    styles: [], labels: [], links: {}, bio: null, bioSource: null, youtubeChannelId: null, similar: [], hasPhoto: false, ...o,
  });
  it('une los 66 y los de Instagram sin duplicar, marca los seguidos y calcula la fama sobre todos', () => {
    const base = [file({ slug: 'wisin', name: 'Wisin', listeners: 1000, similar: ['yandel'] }), file({ slug: 'yandel', name: 'Yandel', listeners: 500 })];
    const ig = [file({ slug: 'feid', name: 'Feid', listeners: 5000 }), file({ slug: 'wisin', name: 'Wisin', listeners: 1 })];
    const all = mergePerreo(base, ig, { wisin: { followed: true, instagram: 'https://www.instagram.com/wisin', similar: ['feid'] } });
    expect(all.map((a) => a.slug)).toEqual(['wisin', 'yandel', 'feid']);
    expect(all.map((a) => a.followed)).toEqual([true, false, true]);
    expect(all[0].similar).toEqual(['yandel', 'feid']);
    expect(all[0].links.instagram).toContain('instagram.com/wisin');
    expect(all.map((a) => a.fame)).toEqual([50, 0, 100]);
    expect(all.map((a) => a.source)).toEqual(['urbanopedia', 'urbanopedia', 'instagram']);
  });
  it('«Solo los que sigo» filtra por seguidos y se combina con el resto', () => {
    const l = [artist({ slug: 'a', followed: true, country: 'Colombia', countries: ['Colombia'] }), artist({ slug: 'b', followed: true }), artist({ slug: 'c' })];
    expect(filterArtists(l, { followed: true }).map((a) => a.slug)).toEqual(['a', 'b']);
    expect(filterArtists(l, { followed: true, country: 'colombia' }).map((a) => a.slug)).toEqual(['a']);
  });
});

describe('tipos de cuenta', () => {
  it('saca el tipo del usuario cuando hay pistas y, si no, queda sin clasificar', () => {
    expect(kindFromUsername('rimasmusic_records')).toBe('label');
    expect(kindFromUsername('dj.pepe')).toBe('dj');
    expect(kindFromUsername('tainyprod')).toBe('producer');
    expect(kindFromUsername('radio.urbana')).toBe('media');
    expect(kindFromUsername('mgmt.latino')).toBe('agency');
    expect(kindFromUsername('luisfonsi')).toBe('unclassified');
  });
  it('Wikidata: el artista que también produce sigue siendo artista; un grupo o un sello, lo suyo', () => {
    expect(kindFromWikidata(['Q177220', 'Q183945'], [])).toBe('artist');
    expect(kindFromWikidata(['Q183945'], [])).toBe('producer');
    expect(kindFromWikidata([], ['Q215380'])).toBe('group');
    expect(kindFromWikidata([], ['Q18127'])).toBe('label');
    expect(kindFromWikidata([], ['Q5'])).toBe('other');
    expect(kindFromMusicBrainz('Group')).toBe('group');
  });
  it('solo artistas y grupos llevan canciones; el contador y el filtro cuentan por tipo', () => {
    expect([hasSongs('artist'), hasSongs('group'), hasSongs('label'), hasSongs('producer')]).toEqual([true, true, false, false]);
    const l = [artist({ slug: 'a' }), artist({ slug: 'p', kind: 'producer' }), artist({ slug: 's', kind: 'label' })];
    expect(filterArtists(l, { kind: 'producer' }).map((a) => a.slug)).toEqual(['p']);
    expect(artistFacets(l).kinds.map((k) => k.value).sort()).toEqual(['artist', 'label', 'producer']);
  });
});

describe('estilos sin IA', () => {
  it('salen de los géneros y etiquetas', () => {
    expect(stylesFromTags(['Latin trap', 'Trap'])).toEqual(['trap']);
    expect(stylesFromTags(['reggaeton', 'urbano'])).toEqual(['perreo']);
    expect(stylesFromTags(['Pop latino', 'balada'])).toEqual(['romántico']);
    expect(stylesFromTags(['dembow', 'reggaeton'])).toEqual(['dembow', 'perreo']);
    expect(stylesFromTags(['rock'])).toEqual([]);
  });
});
