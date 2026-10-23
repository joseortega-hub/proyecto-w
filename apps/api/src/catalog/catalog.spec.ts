import { musicDomain } from '../domains/music.domain.js';
import { facetValues } from './classify-facets.js';
import { facetHas } from '../interview/interview.engine.js';
import { languageFacet } from './jamendo.adapter.js';
import { bookTags, deriveBookAttributes, languagesFacet } from './openlibrary.adapter.js';
import { deriveGameAttributes, platformFacet } from './rawg.adapter.js';
import { deriveMovieAttributes, movieGenres, originalLanguageFacet, type TmdbMovie } from './tmdb.adapter.js';

describe('idioma de la letra', () => {
  it('lee el idioma de Jamendo y marca las instrumentales', () => {
    expect(languageFacet({ vocalinstrumental: 'vocal', lang: 'es' })).toBe('es');
    expect(languageFacet({ vocalinstrumental: 'vocal', lang: 'EN' })).toBe('en');
    expect(languageFacet({ vocalinstrumental: 'vocal', lang: 'fr' })).toBe('other');
    expect(languageFacet({ vocalinstrumental: 'instrumental', lang: 'es' })).toBe('instrumental');
  });

  it('sin idioma en una pista con voz, queda pendiente de clasificar', () => {
    expect(languageFacet({ vocalinstrumental: 'vocal', lang: '' })).toBeNull();
    expect(languageFacet(undefined)).toBeNull();
  });

  it('la clasificación ofrece los valores del dominio sin "me da igual"', () => {
    const [language] = musicDomain.config.preferences!;
    expect(facetValues(language)).toEqual(['es', 'en', 'instrumental', 'other']);
  });
});

describe('facetas con varios valores', () => {
  it('una faceta de lista cumple el filtro si incluye el valor', () => {
    expect(facetHas(['pc', 'switch'], 'switch')).toBe(true);
    expect(facetHas(['pc'], 'xbox')).toBe(false);
    expect(facetHas('es', 'es')).toBe(true);
    expect(facetHas(undefined, 'es')).toBe(false);
  });
});

describe('videojuegos (RAWG)', () => {
  const named = (...slugs: string[]) => slugs.map((slug, id) => ({ id, slug, name: slug }));

  it('un shooter multijugador es frenético y en compañía; un casual relajante, tranquilo', () => {
    const shooter = deriveGameAttributes({ genres: named('shooter'), tags: named('multiplayer', 'fast-paced'), playtime: 12, esrb_rating: { slug: 'mature' } });
    const cozy = deriveGameAttributes({ genres: named('casual', 'simulation'), tags: named('singleplayer', 'relaxing', 'cute'), playtime: 4, esrb_rating: null });
    expect(shooter.intensity).toBeGreaterThan(0.85);
    expect(shooter.social).toBeGreaterThan(0.8);
    expect(cozy.intensity).toBeLessThan(0.2);
    expect(cozy.social).toBeLessThan(0.2);
    expect(cozy.lightness).toBeGreaterThan(shooter.lightness);
  });

  it('el tiempo de juego marca la duración', () => {
    const long = deriveGameAttributes({ genres: named('role-playing-games-rpg'), tags: named('open-world', 'story-rich'), playtime: 90, esrb_rating: null });
    const short = deriveGameAttributes({ genres: named('arcade'), tags: [], playtime: 1, esrb_rating: null });
    expect(long.length).toBe(1);
    expect(short.length).toBeLessThan(0.25);
    expect(long.story).toBeGreaterThan(0.9);
  });

  it('agrupa las plataformas en familias', () => {
    const platforms = (...slugs: string[]) => ({ parent_platforms: slugs.map((slug) => ({ platform: { id: 0, slug, name: slug } })) });
    expect(platformFacet(platforms('pc', 'mac', 'playstation', 'ios', 'android'))).toEqual(['pc', 'playstation', 'mobile']);
    expect(platformFacet({})).toEqual([]);
  });
});

describe('películas (TMDB)', () => {
  const movie = (genre_ids: number[], extra: Partial<TmdbMovie> = {}): TmdbMovie => ({
    id: 1, title: 'x', original_language: 'en', overview: '', poster_path: null, release_date: '2020-05-01',
    genre_ids, popularity: 1, vote_average: 7, vote_count: 1000, ...extra,
  });

  it('una comedia familiar es divertida y para todos; un thriller de crimen, oscuro', () => {
    const comedy = deriveMovieAttributes(movie([35, 10751]));
    const thriller = deriveMovieAttributes(movie([53, 80]));
    expect(comedy.humor).toBeGreaterThan(0.7);
    expect(comedy.family).toBeGreaterThan(0.7);
    expect(thriller.mood).toBeLessThan(0.3);
    expect(thriller.pace).toBeGreaterThan(comedy.pace);
  });

  it('la época sale del año de estreno', () => {
    expect(deriveMovieAttributes(movie([18], { release_date: '1950-01-01' })).era).toBe(0);
    expect(deriveMovieAttributes(movie([18], { release_date: '2025-01-01' })).era).toBe(1);
  });

  it('idioma original y géneros en español', () => {
    expect(originalLanguageFacet('es')).toBe('es');
    expect(originalLanguageFacet('ko')).toBe('other');
    expect(movieGenres({ genres: [{ id: 878, name: 'Ciencia ficción' }] })).toEqual(['ciencia ficción']);
  });
});

describe('libros (Open Library)', () => {
  it('normaliza los temas y no confunde ciencia con ciencia ficción', () => {
    expect(bookTags(['Fiction, science fiction, general', 'Space'])).toEqual(['science_fiction']);
    expect(bookTags(['Popular Science', 'History, Modern'])).toEqual(['history', 'science']);
  });

  it('un ensayo es no ficción y un thriller engancha', () => {
    const essay = deriveBookAttributes({ number_of_pages_median: 600, first_publish_year: 2011 }, ['history', 'science']);
    const thriller = deriveBookAttributes({ number_of_pages_median: 300, first_publish_year: 2003 }, ['thriller', 'mystery']);
    expect(essay.fiction).toBeLessThan(0.1);
    expect(thriller.fiction).toBeGreaterThan(0.9);
    expect(thriller.pace).toBeGreaterThan(essay.pace);
    expect(essay.length).toBeGreaterThan(thriller.length);
  });

  it('idiomas con edición', () => {
    expect(languagesFacet(['eng', 'spa', 'fre', 'ger'])).toEqual(['en', 'es', 'other']);
  });
});
