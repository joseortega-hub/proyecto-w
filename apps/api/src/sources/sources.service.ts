import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { politeFetcher } from '../catalog/derive.js';
import { TmdbAdapter } from '../catalog/tmdb.adapter.js';
import { config } from '../config.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { sourceCache } from '../db/schema.js';

/** Las respuestas de las fuentes cambian poco: un mes en la BD. */
const TTL_MS = 30 * 24 * 60 * 60_000;
const NO_NAME = /^Q\d+$/;
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export interface GoogleBook {
  title: string;
  description: string | null;
}

/**
 * Fuentes extra de refuerzo: confirman y amplían con datos reales lo que la IA entiende o propone
 * (nunca inventan). Cada consulta se guarda en la BD (`source_cache`) y las peticiones a cada
 * servicio van espaciadas. Si una fuente falla o no hay clave, devuelve vacío y todo sigue igual.
 *  - Wikidata: obras de una franquicia, saga, serie o universo.
 *  - Last.fm / ListenBrainz: artistas parecidos y mejores artistas de una etiqueta.
 *  - TMDB: películas similares y recomendadas.
 *  - Google Books: edición en español real y sinopsis.
 */
@Injectable()
export class SourcesService {
  private readonly logger = new Logger('Fuentes');
  private readonly agent = `Sintonia/0.1 (https://github.com/joseortega-hub/proyecto-w${config.musicBrainzContact ? `; ${config.musicBrainzContact}` : ''})`;
  private readonly wikidata = politeFetcher({ minIntervalMs: 1100, name: 'Wikidata', headers: { 'User-Agent': this.agent, Accept: 'application/json' } });
  private readonly lastfm = politeFetcher({ minIntervalMs: 250, name: 'Last.fm', headers: { 'User-Agent': this.agent } });
  private readonly listenbrainz = politeFetcher({ minIntervalMs: 600, name: 'ListenBrainz', headers: { 'User-Agent': this.agent } });
  private readonly musicbrainz = politeFetcher({ minIntervalMs: 1100, name: 'MusicBrainz', headers: { 'User-Agent': this.agent, Accept: 'application/json' } });
  private readonly books = politeFetcher({ minIntervalMs: 200, name: 'Google Books', headers: { 'User-Agent': this.agent } });

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Valor guardado si es reciente; si no, lo pide y lo guarda. Un fallo no se guarda (devuelve `fallback`). También lo usa "Para saber más". */
  async cached<T>(key: string, fallback: T, fetcher: () => Promise<T>): Promise<T> {
    try {
      const [row] = await this.db.select().from(sourceCache).where(eq(sourceCache.key, key));
      if (row && Date.now() - row.fetchedAt.getTime() < TTL_MS) return row.payload as T;
    } catch {
      // Sin caché la fuente se consulta igual.
    }
    try {
      const value = await fetcher();
      await this.db
        .insert(sourceCache)
        .values({ key, payload: value as never })
        .onConflictDoUpdate({ target: sourceCache.key, set: { payload: value as never, fetchedAt: new Date() } })
        .catch(() => undefined);
      return value;
    } catch (error) {
      this.logger.warn(`${key.split(':').slice(0, 2).join(':')} sin respuesta: ${(error as Error).message.slice(0, 100)}`);
      return fallback;
    }
  }

  /**
   * Obras de una franquicia, saga, serie o universo según Wikidata ("Harry Potter" → los libros y
   * las películas), con su nombre en español o inglés. Vacío si no hay una entidad clara.
   */
  franchiseWorks(name: string): Promise<string[]> {
    const q = norm(name);
    if (q.length < 3) return Promise.resolve([]);
    return this.cached(`wikidata:works:${q}`, [], async () => {
      const search = await this.wikidata<{ search?: { id: string; label?: string }[] }>(
        `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbsearchentities', search: name, language: 'es', uselang: 'es', type: 'item', limit: '4', format: 'json' })}`,
      );
      for (const candidate of search.search ?? []) {
        const sparql = `SELECT DISTINCT ?wLabel WHERE { { ?w wdt:P179 wd:${candidate.id} } UNION { ?w wdt:P8345 wd:${candidate.id} } UNION { wd:${candidate.id} wdt:P527 ?w } UNION { ?w wdt:P361 wd:${candidate.id} } SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". } } LIMIT 60`;
        const body = await this.wikidata<{ results: { bindings: { wLabel?: { value: string } }[] } }>(
          `https://query.wikidata.org/sparql?${new URLSearchParams({ query: sparql, format: 'json' })}`,
        );
        const works = [...new Set(body.results.bindings.map((b) => b.wLabel?.value ?? '').filter((w) => w && !NO_NAME.test(w)))];
        if (works.length >= 3) return works;
      }
      return [];
    });
  }

  /** Artistas parecidos: Last.fm y, si no hay clave o no responde, ListenBrainz. */
  similarArtists(artist: string): Promise<string[]> {
    const q = norm(artist);
    if (q.length < 2) return Promise.resolve([]);
    return this.cached(`similar-artists:${q}`, [], async () => {
      if (config.lastfmApiKey) {
        const body = await this.lastfm<{ similarartists?: { artist?: { name: string }[] } }>(
          `https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method: 'artist.getsimilar', artist, autocorrect: '1', limit: '12', api_key: config.lastfmApiKey, format: 'json' })}`,
        ).catch(() => null);
        const names = (body?.similarartists?.artist ?? []).map((a) => a.name);
        if (names.length) return names;
      }
      const found = await this.musicbrainz<{ artists?: { id: string; name: string; score: number }[] }>(
        `https://musicbrainz.org/ws/2/artist?${new URLSearchParams({ query: `artist:"${artist.replace(/["\\]/g, '')}"`, fmt: 'json', limit: '1' })}`,
      );
      const top = found.artists?.[0];
      if (!top || top.score < 90 || norm(top.name) !== q) return [];
      const similar = await this.listenbrainz<{ name?: string }[]>(
        `https://labs.api.listenbrainz.org/similar-artists/json?${new URLSearchParams({ artist_mbids: top.id, algorithm: 'session_based_days_9000_session_300_contribution_5_threshold_15_limit_50_skip_30' })}`,
      );
      return (Array.isArray(similar) ? similar : []).map((s) => s.name ?? '').filter(Boolean).slice(0, 12);
    });
  }

  /** Mejores artistas de una etiqueta o estilo ("reggaeton", "romantic") según Last.fm. */
  tagArtists(tag: string): Promise<string[]> {
    const q = norm(tag);
    if (!config.lastfmApiKey || q.length < 3) return Promise.resolve([]);
    return this.cached(`lastfm:tag:${q}`, [], async () => {
      const body = await this.lastfm<{ topartists?: { artist?: { name: string }[] } }>(
        `https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method: 'tag.gettopartists', tag, limit: '12', api_key: config.lastfmApiKey, format: 'json' })}`,
      );
      return (body.topartists?.artist ?? []).map((a) => a.name);
    });
  }

  /** Películas similares y recomendadas por TMDB para un título o franquicia (primer resultado de la búsqueda). */
  similarMovies(name: string): Promise<string[]> {
    const q = norm(name);
    if (!config.tmdbApiKey || q.length < 3) return Promise.resolve([]);
    return this.cached(`tmdb:similar:${q}`, [], () => new TmdbAdapter(config.tmdbApiKey).similarTitles(name, 10));
  }

  /** Edición en español real de un libro (título y sinopsis), con búsqueda por título y autor. */
  spanishBook(title: string, author: string | null): Promise<GoogleBook | null> {
    const key = `gbooks:${norm(title)}:${norm(author ?? '')}`;
    return this.cached<GoogleBook | null>(key, null, async () => {
      const q = [`intitle:${title.replace(/[":]/g, ' ')}`, author ? `inauthor:${author.split(',')[0].replace(/"/g, '')}` : ''].filter(Boolean).join(' ');
      type Volume = { volumeInfo?: { title?: string; authors?: string[]; description?: string; language?: string } };
      const body = await this.books<{ items?: Volume[] }>(
        `https://www.googleapis.com/books/v1/volumes?${new URLSearchParams({ q, langRestrict: 'es', maxResults: '5', printType: 'books', ...(config.googleBooksApiKey ? { key: config.googleBooksApiKey } : {}) })}`,
      );
      const last = author ? norm(author.split(',')[0]).split(' ').pop()! : '';
      for (const v of body.items ?? []) {
        const info = v.volumeInfo;
        if (!info?.title || info.language !== 'es') continue;
        if (last && !(info.authors ?? []).some((a) => norm(a).includes(last))) continue;
        return { title: info.title, description: info.description?.slice(0, 600) ?? null };
      }
      return null;
    });
  }
}
