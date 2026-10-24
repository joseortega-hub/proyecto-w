import { bookDetails, type ItemDetails } from './item-details.js';
import type { Anchor } from '../interview/interview.types.js';
import { anchorMatchesText } from '../interview/anchors.js';
import type { CatalogAdapter, ImportedItem } from './catalog-adapter.js';
import { clamp, logScale, mapLimit, politeFetcher, priorAverage, yearScale } from './derive.js';

export interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
  subject?: string[];
  language?: string[];
  readinglog_count?: number;
  editions?: { docs: { title?: string; language?: string[] }[] };
}

/** Temas de Open Library con los que se siembra el catálogo. */
export const SEED_SUBJECTS = [
  'fantasy', 'science_fiction', 'mystery', 'thriller', 'romance', 'horror', 'classic_literature', 'historical_fiction',
  'humor', 'adventure', 'young_adult_fiction', 'biography', 'history', 'popular_science', 'philosophy', 'psychology',
  'self-help', 'poetry', 'graphic_novels', 'dystopias',
];

/** Temas normalizados: si un tema de Open Library contiene la pista, el libro lleva la etiqueta. */
const SUBJECT_TAGS: [string, string][] = [
  ['science fiction', 'science_fiction'], ['fantasy', 'fantasy'], ['magic', 'magic'], ['dystopi', 'dystopia'],
  ['mystery', 'mystery'], ['detective', 'detective'], ['thriller', 'thriller'], ['suspense', 'thriller'], ['crime', 'crime'],
  ['romance', 'romance'], ['love stories', 'romance'], ['horror', 'horror'], ['ghost', 'ghost_stories'],
  ['classic', 'classics'], ['literary fiction', 'literature'], ['literature', 'literature'], ['poetry', 'poetry'],
  ['historical fiction', 'historical_fiction'], ['humor', 'humor'], ['humorous', 'humor'], ['adventure', 'adventure'],
  ['young adult', 'young_adult'], ['juvenile fiction', 'young_adult'], ['graphic novel', 'graphic_novels'], ['comic', 'graphic_novels'],
  ['biography', 'biography'], ['autobiography', 'biography'], ['memoir', 'biography'], ['history', 'history'],
  ['popular science', 'science'], ['science', 'science'], ['philosophy', 'philosophy'], ['psychology', 'psychology'],
  ['self-help', 'self-help'], ['self help', 'self-help'], ['business', 'business'], ['economics', 'business'],
];
const NONFICTION = ['history', 'biography', 'science', 'philosophy', 'psychology', 'self-help', 'business'];
/** Temas que no encajan en una demo para todos los públicos. */
const EXCLUDED = ['erotica', 'smut', 'erotic'];

type Scales = { lightness: number; pace: number; mood: number };

const PRIORS: Record<string, Partial<Scales>> = {
  humor: { lightness: 0.85, pace: 0.55, mood: 0.85 },
  young_adult: { lightness: 0.8, pace: 0.65, mood: 0.6 },
  romance: { lightness: 0.75, pace: 0.5, mood: 0.75 },
  adventure: { lightness: 0.7, pace: 0.8, mood: 0.65 },
  graphic_novels: { lightness: 0.85, pace: 0.7, mood: 0.55 },
  mystery: { lightness: 0.65, pace: 0.75, mood: 0.35 },
  detective: { lightness: 0.65, pace: 0.7, mood: 0.35 },
  thriller: { lightness: 0.65, pace: 0.9, mood: 0.25 },
  crime: { lightness: 0.6, pace: 0.75, mood: 0.25 },
  fantasy: { lightness: 0.55, pace: 0.6, mood: 0.55 },
  magic: { lightness: 0.6, pace: 0.6, mood: 0.6 },
  science_fiction: { lightness: 0.45, pace: 0.6, mood: 0.4 },
  dystopia: { lightness: 0.45, pace: 0.65, mood: 0.1 },
  horror: { lightness: 0.55, pace: 0.7, mood: 0.1 },
  ghost_stories: { lightness: 0.6, pace: 0.6, mood: 0.15 },
  classics: { lightness: 0.3, pace: 0.35, mood: 0.45 },
  literature: { lightness: 0.3, pace: 0.3, mood: 0.4 },
  historical_fiction: { lightness: 0.45, pace: 0.45, mood: 0.4 },
  poetry: { lightness: 0.4, pace: 0.2, mood: 0.5 },
  history: { lightness: 0.35, pace: 0.3, mood: 0.4 },
  biography: { lightness: 0.5, pace: 0.35, mood: 0.55 },
  science: { lightness: 0.35, pace: 0.3, mood: 0.55 },
  philosophy: { lightness: 0.1, pace: 0.1, mood: 0.45 },
  psychology: { lightness: 0.45, pace: 0.3, mood: 0.5 },
  'self-help': { lightness: 0.6, pace: 0.35, mood: 0.75 },
  business: { lightness: 0.5, pace: 0.35, mood: 0.55 },
};

/** Etiquetas normalizadas a partir de los temas (muy variados) de Open Library. */
export function bookTags(subjects: string[] = []): string[] {
  const lower = subjects.map((s) => s.toLowerCase());
  const tags = new Set<string>();
  for (const [hint, tag] of SUBJECT_TAGS) {
    if (lower.some((s) => s.includes(hint) && !(hint === 'science' && s.includes('fiction')))) tags.add(tag);
  }
  return [...tags];
}

/** Atributos de escala de un libro a partir de sus etiquetas, páginas y año. */
export function deriveBookAttributes(doc: Pick<OpenLibraryDoc, 'number_of_pages_median' | 'first_publish_year'>, tags: string[]) {
  const base = priorAverage<keyof Scales>(tags, PRIORS, { lightness: 0.5, pace: 0.5, mood: 0.5 });
  const pages = doc.number_of_pages_median;
  const nonfiction = tags.filter((t) => NONFICTION.includes(t)).length;
  const fiction = tags.length - nonfiction;
  return {
    lightness: clamp(base.lightness - (pages && pages > 550 ? 0.15 : 0)),
    pace: clamp(base.pace),
    mood: clamp(base.mood),
    fiction: clamp(nonfiction === 0 ? 0.95 : fiction === 0 ? 0.05 : fiction / (fiction + nonfiction)),
    length: pages ? clamp((pages - 120) / 480) : 0.5,
    era: yearScale(doc.first_publish_year, 1850, 2025),
  };
}

/** Faceta `languages`: idiomas con edición (es, en, other). */
export function languagesFacet(codes: string[] = []): string[] {
  const map: Record<string, string> = { spa: 'es', eng: 'en' };
  return [...new Set(codes.map((c) => map[c] ?? 'other'))];
}

/** Referencia de popularidad para lo que llega por búsqueda en directo. */
const LIVE_MAX_READING_LOG = 50_000;

/**
 * Libros de Open Library (https://openlibrary.org/developers/api). Sin clave; pide
 * identificarse con un User-Agent y, así, admite hasta 3 peticiones por segundo (1 sin
 * contacto). Una búsqueda por tema y una petición por obra para la sinopsis.
 */
export class OpenLibraryAdapter implements CatalogAdapter {
  readonly domainId = 'books';
  readonly source = 'openlibrary';
  private readonly get: ReturnType<typeof politeFetcher>;

  constructor(contact = '') {
    const agent = `Sintonia/0.1 (https://github.com/joseortega-hub/proyecto-w${contact ? `; ${contact}` : ''})`;
    this.get = politeFetcher({ minIntervalMs: contact ? 400 : 1100, name: 'Open Library', headers: { 'User-Agent': agent } });
  }

  async fetchItems({ limit, onProgress }: { limit: number; onProgress?: (m: string) => void }) {
    const seeds = [
      ...SEED_SUBJECTS.map((s) => ({ label: s, q: `subject:${s}`, limit: Math.ceil((limit * 1.3) / (SEED_SUBJECTS.length + 2)) })),
      { label: 'en español', q: 'language:spa', limit: 60 },
    ];
    const byKey = new Map<string, OpenLibraryDoc>();
    for (const seed of seeds) {
      const url = new URL('https://openlibrary.org/search.json');
      url.search = new URLSearchParams({
        q: seed.q,
        sort: 'readinglog',
        limit: String(seed.limit),
        lang: 'es',
        fields: 'key,title,author_name,first_publish_year,number_of_pages_median,cover_i,subject,language,readinglog_count,editions,editions.title,editions.language',
      }).toString();
      const body = await this.get<{ docs: OpenLibraryDoc[] }>(url);
      for (const d of body.docs) {
        const subjects = (d.subject ?? []).map((s) => s.toLowerCase());
        if (byKey.has(d.key) || !d.author_name?.length || subjects.some((s) => EXCLUDED.some((x) => s.includes(x)))) continue;
        if (byKey.size < limit) byKey.set(d.key, d);
      }
      onProgress?.(`${seed.label}: ${body.docs.length} libros (total único: ${byKey.size})`);
    }

    const docs = [...byKey.values()];
    let done = 0;
    const descriptions = await mapLimit(docs, 2, async (d) => {
      const work = await this.get<{ description?: string | { value: string } }>(`https://openlibrary.org${d.key}.json`);
      if (++done % 50 === 0) onProgress?.(`sinopsis: ${done}/${docs.length}`);
      const text = typeof work.description === 'string' ? work.description : work.description?.value;
      return text?.replace(/\s+/g, ' ').replace(/\(\[source\].*$/i, '').trim().slice(0, 700) || null;
    });
    const maxLog = Math.max(...docs.map((d) => d.readinglog_count ?? 0));
    return docs.map((d, i) => this.toItem(d, descriptions[i], maxLog));
  }

  /**
   * Búsqueda en directo: por autor si pidió a alguien ("Brandon Sanderson") y por texto en
   * el resto ("Harry Potter"). Sin sinopsis, para no esperar una petición por obra.
   */
  async search(anchor: Anchor, limit: number): Promise<ImportedItem[]> {
    const url = new URL('https://openlibrary.org/search.json');
    url.search = new URLSearchParams({
      ...(anchor.kind === 'creator' ? { author: anchor.label } : { q: anchor.label }),
      sort: 'readinglog',
      limit: String(limit * 2),
      lang: 'es',
      fields: 'key,title,author_name,first_publish_year,number_of_pages_median,cover_i,subject,language,readinglog_count,editions,editions.title,editions.language',
    }).toString();
    const body = await this.get<{ docs: OpenLibraryDoc[] }>(url).catch(() => ({ docs: [] as OpenLibraryDoc[] }));
    const docs = body.docs
      .filter((d) => d.author_name?.length && anchorMatchesText(`${d.title} ${d.author_name.join(' ')} ${(d.subject ?? []).join(' ')}`, anchor))
      .slice(0, limit);
    return docs.map((d) => this.toItem(d, null, LIVE_MAX_READING_LOG));
  }

  /** Autoría, año, páginas y temas de un libro ya importado (script de relleno). */
  async details(externalId: string): Promise<ItemDetails> {
    const url = new URL('https://openlibrary.org/search.json');
    url.search = new URLSearchParams({
      q: `key:/works/${externalId}`,
      fields: 'key,author_name,first_publish_year,number_of_pages_median,subject',
      limit: '1',
    }).toString();
    const body = await this.get<{ docs: OpenLibraryDoc[] }>(url);
    return body.docs[0] ? bookDetails(body.docs[0]) : {};
  }

  private toItem(d: OpenLibraryDoc, description: string | null, maxLog: number): ImportedItem {
    const tags = bookTags(d.subject);
    // Con `lang=es`, Open Library adjunta la edición en español si existe: se usa su título,
    // solo si esa edición es únicamente en español (las bilingües traen títulos en gallego, catalán…).
    const edition = d.editions?.docs[0];
    const title = edition?.title && edition.language?.length === 1 && edition.language[0] === 'spa' ? edition.title : d.title;
    const raw = (d.subject ?? []).filter((s) => s.length <= 30).slice(0, 6).map((s) => s.toLowerCase());
    return {
      source: this.source,
      externalId: d.key.replace('/works/', ''),
      title,
      subtitle: d.author_name?.slice(0, 2).join(', ') ?? null,
      description: description ?? (title !== d.title ? `Título original: ${d.title}` : null),
      imageUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      mediaUrl: null,
      externalUrl: `https://openlibrary.org${d.key}`,
      durationSec: null,
      attributes: deriveBookAttributes(d, tags),
      tags: [...new Set([...tags, ...raw])],
      popularity: logScale(d.readinglog_count ?? 0, maxLog),
      details: bookDetails(d),
      facets: {
        languages: languagesFacet(d.language),
        ...(d.first_publish_year ? { year: String(d.first_publish_year) } : {}),
      },
    };
  }
}
