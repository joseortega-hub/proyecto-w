import type { Anchor } from '../interview/interview.types.js';
import { anchorMatchesText } from '../interview/anchors.js';
import { bestName, nameQueries } from '../interview/named.js';
import { anchorTag, type CatalogAdapter, type ImportedItem } from './catalog-adapter.js';
import { movieDetails, type ItemDetails } from './item-details.js';
import { clamp, logScale, mapLimit, nudge, politeFetcher, priorAverage, yearScale } from './derive.js';

export interface TmdbMovie {
  id: number;
  title: string;
  original_language: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  popularity: number;
  vote_average: number;
  vote_count: number;
  runtime?: number | null;
  credits?: { crew: { job: string; name: string }[]; cast?: { name: string; order?: number }[] };
  keywords?: { keywords: { name: string }[] };
  production_companies?: { id: number; name: string }[];
  belongs_to_collection?: { id: number; name: string } | null;
}

/** Facetas estructuradas de una película: productoras y colección (saga), tal y como las da TMDB. */
export const movieEntityFacets = (m: Pick<TmdbMovie, 'production_companies' | 'belongs_to_collection'>): Record<string, string | string[]> => ({
  ...(m.production_companies?.length ? { companies: m.production_companies.slice(0, 6).map((c) => c.name) } : {}),
  ...(m.belongs_to_collection?.name ? { collection: m.belongs_to_collection.name } : {}),
});

/** Páginas de 20 que trae como mucho una búsqueda en directo por compañía, palabra clave o persona. */
const LIVE_PAGES = 5;

/** Géneros de TMDB por id, con el nombre que se guarda como etiqueta. */
export const TMDB_GENRES: Record<number, string> = {
  28: 'acción', 12: 'aventura', 16: 'animación', 35: 'comedia', 80: 'crimen', 99: 'documental', 18: 'drama',
  10751: 'familia', 14: 'fantasía', 36: 'historia', 27: 'terror', 10402: 'música', 9648: 'misterio',
  10749: 'romance', 878: 'ciencia ficción', 10770: 'película de tv', 53: 'suspense', 10752: 'bélica', 37: 'western',
};

type Scales = { pace: number; mood: number; humor: number; depth: number; romance: number; family: number };

const GENRE_PRIORS: Record<string, Partial<Scales>> = {
  acción: { pace: 0.85, mood: 0.5, humor: 0.3, depth: 0.25, romance: 0.2, family: 0.35 },
  aventura: { pace: 0.75, mood: 0.65, humor: 0.35, depth: 0.3, romance: 0.25, family: 0.55 },
  animación: { pace: 0.55, mood: 0.8, humor: 0.55, depth: 0.35, romance: 0.2, family: 0.85 },
  comedia: { pace: 0.5, mood: 0.8, humor: 0.9, depth: 0.3, romance: 0.35, family: 0.5 },
  crimen: { pace: 0.6, mood: 0.25, humor: 0.2, depth: 0.55, romance: 0.15, family: 0.1 },
  documental: { pace: 0.25, mood: 0.5, humor: 0.2, depth: 0.85, romance: 0.05, family: 0.5 },
  drama: { pace: 0.3, mood: 0.35, humor: 0.15, depth: 0.7, romance: 0.4, family: 0.35 },
  familia: { pace: 0.5, mood: 0.85, humor: 0.55, depth: 0.2, romance: 0.15, family: 0.95 },
  fantasía: { pace: 0.6, mood: 0.6, humor: 0.3, depth: 0.4, romance: 0.3, family: 0.55 },
  historia: { pace: 0.35, mood: 0.35, humor: 0.1, depth: 0.75, romance: 0.3, family: 0.35 },
  terror: { pace: 0.7, mood: 0.1, humor: 0.1, depth: 0.3, romance: 0.1, family: 0.05 },
  música: { pace: 0.45, mood: 0.7, humor: 0.3, depth: 0.45, romance: 0.4, family: 0.5 },
  misterio: { pace: 0.55, mood: 0.3, humor: 0.15, depth: 0.6, romance: 0.15, family: 0.25 },
  romance: { pace: 0.35, mood: 0.7, humor: 0.4, depth: 0.45, romance: 0.9, family: 0.35 },
  'ciencia ficción': { pace: 0.65, mood: 0.45, humor: 0.2, depth: 0.6, romance: 0.15, family: 0.35 },
  suspense: { pace: 0.75, mood: 0.25, humor: 0.1, depth: 0.5, romance: 0.15, family: 0.15 },
  bélica: { pace: 0.65, mood: 0.15, humor: 0.05, depth: 0.65, romance: 0.15, family: 0.15 },
  western: { pace: 0.55, mood: 0.4, humor: 0.2, depth: 0.45, romance: 0.2, family: 0.3 },
};

const MOOD = { 'feel-good': 0.2, friendship: 0.1, 'coming of age': 0.05, dystopia: -0.2, death: -0.1, 'serial killer': -0.2, revenge: -0.1, war: -0.1, suicide: -0.2 };
const HUMOR = { parody: 0.3, satire: 0.2, 'dark comedy': 0.2, 'buddy comedy': 0.2, spoof: 0.3 };
const DEPTH = { philosophy: 0.15, 'based on true story': 0.1, biography: 0.1, 'time travel': 0.05, 'mind-bending': 0.15, superhero: -0.15, sequel: -0.05 };
const ROMANCE = { 'love triangle': 0.2, 'romantic comedy': 0.3, 'falling in love': 0.2 };

/** Atributos de escala de una película a partir de géneros, palabras clave, año y nota. */
export function deriveMovieAttributes(movie: TmdbMovie): Record<string, number> {
  const genres = movieGenres(movie);
  const keywords = (movie.keywords?.keywords ?? []).map((k) => k.name.toLowerCase());
  const base = priorAverage<keyof Scales>(genres, GENRE_PRIORS, { pace: 0.5, mood: 0.5, humor: 0.3, depth: 0.45, romance: 0.2, family: 0.4 });
  const year = Number(movie.release_date?.slice(0, 4)) || null;
  return {
    pace: clamp(base.pace - (movie.runtime && movie.runtime > 150 ? 0.08 : 0)),
    mood: clamp(base.mood + nudge(keywords, MOOD)),
    humor: clamp(base.humor + nudge(keywords, HUMOR)),
    depth: clamp(base.depth + nudge(keywords, DEPTH) + (movie.vote_average >= 8 ? 0.1 : 0)),
    romance: clamp(base.romance + nudge(keywords, ROMANCE)),
    family: clamp(base.family),
    era: yearScale(year, 1950, 2025),
  };
}

export const movieGenres = (movie: Pick<TmdbMovie, 'genres' | 'genre_ids'>) =>
  (movie.genres?.map((g) => g.id) ?? movie.genre_ids ?? []).map((id) => TMDB_GENRES[id]).filter(Boolean);

/** Votos de referencia para la popularidad de lo que llega por búsqueda en directo (≈ las más votadas). */
const LIVE_MAX_VOTES = 35_000;

/** Faceta `language`: idioma original es, en u other. */
export const originalLanguageFacet = (lang: string) => (lang === 'es' || lang === 'en' ? lang : 'other');

/**
 * Películas de TMDB (https://developer.themoviedb.org). Clave gratuita de desarrollador
 * para uso no comercial; la app muestra la atribución obligatoria. Acepta la API Key (v3)
 * o el token de lectura (v4). Listados por género, cine en español y clásicos, y un
 * detalle por película (duración, dirección y palabras clave).
 */
export class TmdbAdapter implements CatalogAdapter {
  readonly domainId = 'movies';
  readonly source = 'tmdb';
  private readonly get: ReturnType<typeof politeFetcher>;
  private readonly bearer: boolean;

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error('Falta TMDB_API_KEY en .env (https://www.themoviedb.org/settings/api)');
    // El token v4 es un JWT largo; la clave v3 son 32 caracteres hexadecimales.
    this.bearer = apiKey.length > 40;
    this.get = politeFetcher({
      minIntervalMs: 60,
      name: 'TMDB',
      headers: this.bearer ? { Authorization: `Bearer ${apiKey}` } : undefined,
    });
  }

  async fetchItems({ limit, onProgress }: { limit: number; onProgress?: (m: string) => void }) {
    const common = { language: 'es-ES', include_adult: 'false', 'vote_count.gte': '300' };
    const seeds: { label: string; params: Record<string, string>; pages: number }[] = [
      ...Object.entries(TMDB_GENRES)
        .filter(([id]) => id !== '10770')
        .map(([id, name]) => ({ label: name, params: { with_genres: id, sort_by: 'popularity.desc' }, pages: 1 })),
      { label: 'cine en español', params: { with_original_language: 'es', sort_by: 'popularity.desc', 'vote_count.gte': '100' }, pages: 3 },
      { label: 'clásicos', params: { 'primary_release_date.lte': '1985-12-31', sort_by: 'vote_count.desc' }, pages: 2 },
      { label: 'mejor valoradas', params: { sort_by: 'vote_average.desc', 'vote_count.gte': '2000' }, pages: 2 },
      { label: 'populares', params: { sort_by: 'popularity.desc' }, pages: 4 },
    ];

    const byId = new Map<number, TmdbMovie>();
    for (const seed of seeds) {
      for (let page = 1; page <= seed.pages && byId.size < limit; page++) {
        const body = await this.get<{ results: TmdbMovie[] }>(this.url('discover/movie', { ...common, ...seed.params, page: String(page) }));
        for (const m of body.results) if (!byId.has(m.id) && m.overview && byId.size < limit) byId.set(m.id, m);
      }
      onProgress?.(`${seed.label} (total único: ${byId.size})`);
    }

    const movies = [...byId.values()];
    let done = 0;
    const details = await mapLimit(movies, 6, async (m) => {
      const detail = await this.get<TmdbMovie>(this.url(`movie/${m.id}`, { language: 'es-ES', append_to_response: 'credits,keywords' }));
      if (++done % 100 === 0) onProgress?.(`detalles: ${done}/${movies.length}`);
      return detail;
    });
    const maxVotes = Math.max(...movies.map((m) => m.vote_count));
    return movies.map((m, i) => this.toItem({ ...m, ...details[i] }, maxVotes));
  }

  /** Persona, compañía o colección con su nombre real (la búsqueda de TMDB no tolera bien las erratas: se prueba también por palabras). */
  async resolveName(name: string, kinds: Anchor['kind'][]): Promise<{ name: string; kind: Anchor['kind'] } | null> {
    const paths: [Anchor['kind'], string][] = [['creator', 'search/person'], ['studio', 'search/company'], ['franchise', 'search/collection']];
    const hits = await Promise.all(
      paths
        .filter(([kind]) => kinds.includes(kind))
        .map(async ([kind, path]) => {
          const names: { name: string }[] = [];
          for (const query of nameQueries(name).filter((q) => !q.endsWith('*'))) {
            const body = await this.get<{ results: { name?: string }[] }>(this.url(path, { query })).catch(() => ({ results: [] as { name?: string }[] }));
            names.push(...body.results.slice(0, 6).filter((r): r is { name: string } => !!r.name));
            if (bestName(name, names)) break;
          }
          const best = bestName(name, names);
          return best ? { name: best.candidate.name, kind, similarity: best.similarity } : null;
        }),
    );
    return hits.filter((h): h is NonNullable<typeof h> => !!h).sort((a, b) => b.similarity - a.similarity)[0] ?? null;
  }

  /**
   * Búsqueda en directo: compañía ("Marvel Studios") y palabra clave para franquicias y
   * estudios, persona para quien dirige o actúa, y título en todos los casos. Lo que sale de
   * una compañía, persona o palabra clave se marca con la etiqueta del ancla.
   */
  async search(anchor: Anchor, limit: number): Promise<ImportedItem[]> {
    const query = anchor.label;
    /** Todas las páginas de un discover (hasta `LIVE_PAGES`): "todas las de Marvel", no las 20 primeras. */
    const discover = async (params: Record<string, string>) => {
      const out: TmdbMovie[] = [];
      for (let page = 1; page <= LIVE_PAGES; page++) {
        const body = await this.get<{ results: TmdbMovie[]; total_pages: number }>(
          this.url('discover/movie', { language: 'es-ES', include_adult: 'false', sort_by: 'popularity.desc', 'vote_count.gte': '50', ...params, page: String(page) }),
        ).catch(() => ({ results: [] as TmdbMovie[], total_pages: 0 }));
        out.push(...body.results);
        if (page >= body.total_pages) break;
      }
      return out;
    };
    const search = (path: string) =>
      this.get<{ results: { id: number; name?: string }[] }>(this.url(path, { query }))
        .then((b) => b.results)
        .catch(() => [] as { id: number; name?: string }[]);
    // Solo lo que se llama como lo pedido ("Marvel Studios" sí, "Marvelous Films" no).
    const named = (r: { name?: string }) => !!r.name && anchorMatchesText(r.name, anchor);

    const tagged: TmdbMovie[] = [];
    if (anchor.kind === 'creator') {
      const people = (await search('search/person')).slice(0, 1).map((r) => r.id);
      if (people.length) tagged.push(...(await discover({ with_people: people.join('|') })));
    } else if (anchor.kind !== 'title') {
      const [companies, collections, keywords] = await Promise.all([search('search/company'), search('search/collection'), search('search/keyword')]);
      const companyIds = companies.filter(named).slice(0, 4).map((r) => r.id);
      if (companyIds.length) tagged.push(...(await discover({ with_companies: companyIds.join('|') })));
      for (const c of collections.filter(named).slice(0, 3)) {
        const body = await this.get<{ parts: TmdbMovie[] }>(this.url(`collection/${c.id}`, { language: 'es-ES' })).catch(() => ({ parts: [] as TmdbMovie[] }));
        tagged.push(...body.parts.filter((m) => m.vote_count >= 50));
      }
      const keywordIds = keywords.filter(named).slice(0, 2).map((r) => r.id);
      if (keywordIds.length && tagged.length < limit) tagged.push(...(await discover({ with_keywords: keywordIds.join('|') })));
    }
    const byTitle = await this.get<{ results: TmdbMovie[] }>(this.url('search/movie', { query, language: 'es-ES', include_adult: 'false' }))
      .then((b) => b.results.filter((m) => m.overview && m.vote_count >= 50 && (anchor.kind === 'title' || anchorMatchesText(m.title, anchor))))
      .catch(() => [] as TmdbMovie[]);

    const byId = new Map<number, { movie: TmdbMovie; tagged: boolean }>();
    for (const m of tagged) if (m.overview && !byId.has(m.id)) byId.set(m.id, { movie: m, tagged: true });
    for (const m of byTitle) if (!byId.has(m.id)) byId.set(m.id, { movie: m, tagged: false });
    const found = [...byId.values()].sort((a, b) => b.movie.vote_count - a.movie.vote_count).slice(0, limit);
    const details = await mapLimit(found, 6, ({ movie }) =>
      this.get<TmdbMovie>(this.url(`movie/${movie.id}`, { language: 'es-ES', append_to_response: 'credits,keywords' })).catch(() => movie),
    );
    return found.map(({ movie, tagged: isTagged }, i) => {
      const item = this.toItem({ ...movie, ...details[i] }, LIVE_MAX_VOTES);
      return isTagged ? { ...item, tags: [...new Set([...(item.tags ?? []), anchorTag(anchor)])] } : item;
    });
  }

  /**
   * Títulos que TMDB da como recomendados y similares de la película que mejor casa con `name`
   * ("parecido a X" con datos reales). Vacío si la búsqueda no encuentra nada claro.
   */
  async similarTitles(name: string, limit: number): Promise<string[]> {
    const found = await this.get<{ results: TmdbMovie[] }>(this.url('search/movie', { query: name, language: 'es-ES', include_adult: 'false' })).catch(() => ({ results: [] as TmdbMovie[] }));
    const top = found.results.filter((m) => m.vote_count >= 200).sort((a, b) => b.vote_count - a.vote_count)[0];
    if (!top) return [];
    const [recommended, similar] = await Promise.all(
      ['recommendations', 'similar'].map((path) =>
        this.get<{ results: TmdbMovie[] }>(this.url(`movie/${top.id}/${path}`, { language: 'es-ES' }))
          .then((b) => b.results.filter((m) => m.vote_count >= 100))
          .catch(() => [] as TmdbMovie[]),
      ),
    );
    return [...new Set([...recommended, ...similar].map((m) => m.title))].slice(0, limit);
  }

  /** Productoras y colección de una película ya importada (script de relleno de facetas). */
  async entityFacets(externalId: string) {
    return movieEntityFacets(await this.get<TmdbMovie>(this.url(`movie/${externalId}`, { language: 'es-ES' })));
  }

  /** Créditos de una película ya importada (script de relleno). */
  async details(externalId: string): Promise<ItemDetails> {
    return movieDetails(await this.get<TmdbMovie>(this.url(`movie/${externalId}`, { language: 'es-ES', append_to_response: 'credits' })));
  }

  private url(path: string, params: Record<string, string> = {}) {
    const url = new URL(`https://api.themoviedb.org/3/${path}`);
    url.search = new URLSearchParams(this.bearer ? params : { api_key: this.apiKey, ...params }).toString();
    return url;
  }

  private toItem(m: TmdbMovie, maxVotes: number): ImportedItem {
    const director = m.credits?.crew.find((c) => c.job === 'Director')?.name ?? null;
    const keywords = (m.keywords?.keywords ?? []).slice(0, 8).map((k) => k.name.toLowerCase());
    const year = m.release_date?.slice(0, 4);
    return {
      source: this.source,
      externalId: String(m.id),
      title: m.title,
      subtitle: director,
      description: m.overview || null,
      imageUrl: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
      mediaUrl: null,
      externalUrl: `https://www.themoviedb.org/movie/${m.id}`,
      durationSec: m.runtime ? m.runtime * 60 : null,
      attributes: deriveMovieAttributes(m),
      tags: [...new Set([...movieGenres(m), ...keywords])],
      popularity: logScale(m.vote_count, maxVotes),
      facets: { language: originalLanguageFacet(m.original_language), ...(year ? { year } : {}), ...movieEntityFacets(m) },
      details: movieDetails(m),
    };
  }
}
