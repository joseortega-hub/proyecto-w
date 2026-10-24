import { config } from '../config.js';

export interface MusicBrainzRecording {
  id: string;
  title: string;
  artist: string;
  durationSec: number | null;
  /** Puntuación de MusicBrainz (0–100). */
  score: number;
}

interface SearchResponse {
  recordings?: {
    id: string;
    title: string;
    score: number;
    length?: number;
    'artist-credit'?: { name: string; joinphrase?: string }[];
  }[];
}

/** Sin tildes, mayúsculas ni signos: para comparar nombres escritos de distinta forma. */
export const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(feat|ft|featuring|with)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** ¿Es el mismo nombre (o uno contiene al otro, como "Bad Bunny" en "Bad Bunny, Jhay Cortez")? */
export function sameName(a: string, b: string): boolean {
  const [x, y] = [normalizeName(a), normalizeName(b)];
  if (!x || !y) return false;
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)));
}

const lucene = (value: string) => `"${value.replace(/(["\\])/g, '\\$1')}"`;

/**
 * Cliente mínimo de MusicBrainz (https://musicbrainz.org/doc/MusicBrainz_API): su límite es de
 * 1 petición por segundo, así que las llamadas se encolan con un hueco entre ellas, y exige un
 * User-Agent identificable. Solo busca grabaciones; es genérico para otros usos (datos extra).
 */
export class MusicBrainzClient {
  private chain: Promise<unknown> = Promise.resolve();
  private last = 0;

  constructor(
    private readonly contact: string = config.musicBrainzContact,
    private readonly gapMs = 1100,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private get userAgent() {
    return `Sintonia/0.1 ( ${this.contact || 'https://github.com/joseortega-hub/proyecto-w'} )`;
  }

  private schedule<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const wait = this.last + this.gapMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await job();
      } finally {
        this.last = Date.now();
      }
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Mejor grabación para artista + título, o null si no hay una coincidencia clara. */
  async findRecording(artist: string | null, title: string): Promise<MusicBrainzRecording | null> {
    const query = [`recording:${lucene(title)}`, artist ? `artist:${lucene(artist)}` : null].filter(Boolean).join(' AND ');
    const url = `https://musicbrainz.org/ws/2/recording?${new URLSearchParams({ query, fmt: 'json', limit: '5' })}`;
    const data = await this.schedule(async () => {
      const res = await this.fetcher(url, { headers: { 'User-Agent': this.userAgent, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
      return (await res.json()) as SearchResponse;
    });
    for (const r of data.recordings ?? []) {
      const credit = r['artist-credit'] ?? [];
      const found = credit.map((c) => c.name + (c.joinphrase ?? '')).join('').trim();
      // El título tiene que ser el mismo y, si se conoce, el artista también: la IA y MusicBrainz no deben contradecirse.
      if (r.score >= 85 && sameName(r.title, title) && (!artist || sameName(found, artist))) {
        return { id: r.id, title: r.title, artist: found, durationSec: r.length ? Math.round(r.length / 1000) : null, score: r.score };
      }
    }
    return null;
  }
}
