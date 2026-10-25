// "Para saber más": de una entidad de Wikidata (franquicia, saga, autor, estudio, artista) a sus
// mejores enlaces. Todo sale de datos reales de Wikidata; la IA nunca propone ni completa una URL.

export type LinkSite =
  | 'official'
  | 'wikipedia'
  | 'fandom'
  | 'tmdb'
  | 'rawg'
  | 'openlibrary'
  | 'musicbrainz'
  | 'reddit'
  | 'instagram'
  | 'youtube'
  | 'x';

export interface ExternalLink {
  site: LinkSite;
  url: string;
}

export interface EntityLinks {
  query: string;
  entity: { id: string; label: string; description: string | null } | null;
  links: ExternalLink[];
}

/** Lo que usamos de `wbgetentities` (props labels, aliases, descriptions, claims y sitelinks). */
export interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, { rank?: string; mainsnak?: { datavalue?: { value?: unknown } } }[]>;
  sitelinks?: Record<string, { title: string }>;
}

export const MAX_LINKS = 6;

/** Páginas que no son la entidad: desambiguaciones, apellidos, nombres de pila, listas, discografías y personajes. */
const NOT_AN_ENTITY = new Set(['Q4167410', 'Q22808320', 'Q101352', 'Q202444', 'Q12308941', 'Q11879590', 'Q13406463', 'Q273057', 'Q104635718', 'Q15773347', 'Q95074', 'Q15632617']);

/** Ficha en el catálogo de cada temática: propiedad de Wikidata → URL. */
const CATALOG: Record<string, { site: LinkSite; props: [string, (id: string) => string][] }> = {
  movies: {
    site: 'tmdb',
    props: [
      ['P11805', (id) => `https://www.themoviedb.org/collection/${id}`],
      ['P4947', (id) => `https://www.themoviedb.org/movie/${id}`],
      ['P4983', (id) => `https://www.themoviedb.org/tv/${id}`],
      ['P4985', (id) => `https://www.themoviedb.org/person/${id}`],
      ['P11806', (id) => `https://www.themoviedb.org/company/${id}`],
    ],
  },
  games: {
    site: 'rawg',
    props: [
      ['P9968', (id) => `https://rawg.io/games/${id}`],
      ['P11792', (id) => `https://rawg.io/developers/${id}`],
      ['P11793', (id) => `https://rawg.io/publishers/${id}`],
      ['P8844', (id) => `https://rawg.io/creators/${id}`],
    ],
  },
  books: {
    site: 'openlibrary',
    props: [['P648', (id) => `https://openlibrary.org/${id.endsWith('A') ? 'authors' : id.endsWith('M') ? 'books' : 'works'}/${id}`]],
  },
  music: { site: 'musicbrainz', props: [['P434', (id) => `https://musicbrainz.org/artist/${id}`]] },
};
CATALOG.youtube = CATALOG.music;
CATALOG.folder = CATALOG.music;
CATALOG.perreo = CATALOG.music;

/** Palabras de la descripción de Wikidata que delatan la temática ("empresa creadora de videojuegos"). */
const DOMAIN_WORDS: [string, RegExp][] = [
  ['movies', /pel[ií]cula|cinematogr|\bcine\b|\bfilm|director|cineasta|actor|actriz|productora|serie de televisi/],
  ['games', /videojuego|consola|desarrolladora|\bjuego/],
  ['books', /\blibro|novel|escritor|escritora|autor|autora|literari|heptalog|trilog|poeta|historieta|c[oó]mic|editorial/],
  ['music', /cantante|rapero|rapera|m[uú]sic|banda|grupo|disco|discogr|productor/],
];
const DOMAIN_ALIAS: Record<string, string> = { youtube: 'music', folder: 'music', perreo: 'music' };

export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Valores de una propiedad sin los obsoletos, con los preferidos primero. */
export function claimValues(entity: WikidataEntity, prop: string): string[] {
  const claims = (entity.claims?.[prop] ?? []).filter((c) => c.rank !== 'deprecated');
  claims.sort((a, b) => Number(b.rank === 'preferred') - Number(a.rank === 'preferred'));
  return claims
    .map((c) => {
      const v = c.mainsnak?.datavalue?.value;
      return typeof v === 'string' ? v : v && typeof v === 'object' && 'id' in v ? String((v as { id: unknown }).id) : '';
    })
    .filter(Boolean);
}

/** Temática que sugiere la descripción: la de la palabra que aparece antes. */
export function describedDomain(description: string | null): string | null {
  if (!description) return null;
  const text = description.toLowerCase();
  let best: { domain: string; at: number } | null = null;
  for (const [domain, re] of DOMAIN_WORDS) {
    const at = text.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { domain, at };
  }
  return best?.domain ?? null;
}

/** Wikidata guarda muchos nombres propios en `mul` (todas las lenguas) en vez de en `es`. */
const LANGS = ['es', 'mul', 'en'] as const;
const label = (e: WikidataEntity) => LANGS.map((l) => e.labels?.[l]?.value).find(Boolean) ?? e.id;
const description = (e: WikidataEntity) => e.descriptions?.es?.value ?? e.descriptions?.en?.value ?? null;

/** Fandom: artículo (`es.marvel:Tierra-199999`) o wiki entera (`marvel`); en español si lo hay. */
export function fandomUrl(entity: WikidataEntity): string | null {
  const toUrl = (wiki: string, page?: string) => {
    const [lang, name] = wiki.includes('.') ? wiki.split('.', 2) : [null, wiki];
    if (!/^[a-z0-9-]+$/i.test(name)) return null;
    const base = `https://${name}.fandom.com${lang ? `/${lang}` : ''}`;
    return page ? `${base}/wiki/${encodeURIComponent(page.replace(/ /g, '_')).replace(/%2F/g, '/')}` : `${base}/`;
  };
  const pick = (values: string[]) => values.find((v) => v.startsWith('es.')) ?? values.find((v) => !/^[a-z-]{2,5}\./.test(v));
  const article = pick(claimValues(entity, 'P6262'));
  if (article && article.includes(':')) {
    const at = article.indexOf(':');
    const url = toUrl(article.slice(0, at), article.slice(at + 1));
    if (url) return url;
  }
  const wiki = pick(claimValues(entity, 'P4073'));
  return wiki ? toUrl(wiki) : null;
}

/** Web oficial: la que apunta a España o al español si la hay; si no, la preferida. */
function officialUrl(entity: WikidataEntity): string | null {
  const sites = claimValues(entity, 'P856').filter((u) => /^https?:\/\//.test(u));
  return sites.find((u) => /\.es(\/|$)|\/es(-es)?(\/|$)|[?&]lang=es/i.test(u)) ?? sites[0] ?? null;
}

const handle = (v: string) => (/^[\w.-]+$/.test(v) ? v : null);

/** Todos los enlaces posibles de la entidad, en orden de interés, antes de verificarlos. */
export function candidateLinks(entity: WikidataEntity, domain: string): ExternalLink[] {
  const out: ExternalLink[] = [];
  const add = (site: LinkSite, url: string | null | undefined) => {
    if (url && !out.some((l) => l.url === url)) out.push({ site, url });
  };
  add('official', officialUrl(entity));
  const es = entity.sitelinks?.eswiki?.title;
  add('wikipedia', es ? `https://es.wikipedia.org/wiki/${encodeURIComponent(es.replace(/ /g, '_'))}` : null);
  add('fandom', fandomUrl(entity));
  const catalog = CATALOG[domain];
  for (const [prop, toUrl] of catalog?.props ?? []) {
    const id = claimValues(entity, prop)[0];
    if (id && /^[\w.-]+$/.test(id)) {
      add(catalog.site, toUrl(id));
      break;
    }
  }
  const sub = handle(claimValues(entity, 'P3984')[0] ?? '');
  add('reddit', sub ? `https://www.reddit.com/r/${sub}/` : null);
  const ig = handle(claimValues(entity, 'P2003')[0] ?? '');
  add('instagram', ig ? `https://www.instagram.com/${ig}/` : null);
  const yt = handle(claimValues(entity, 'P2397')[0] ?? '');
  add('youtube', yt ? `https://www.youtube.com/channel/${yt}` : null);
  const x = handle(claimValues(entity, 'P2002')[0] ?? '');
  add('x', x ? `https://x.com/${x}` : null);
  return out;
}

/**
 * Entre los resultados de la búsqueda, la entidad que es lo pedido: el nombre tiene que coincidir
 * y suman tener ficha en el catálogo de la temática, una descripción de esa temática y enlaces.
 * Las desambiguaciones, apellidos, listas y personajes no cuentan. Null si ninguna convence.
 */
export function pickEntity(query: string, domain: string, entities: WikidataEntity[]): WikidataEntity | null {
  const q = norm(query);
  const target = DOMAIN_ALIAS[domain] ?? domain;
  let best: { entity: WikidataEntity; score: number } | null = null;
  entities.forEach((entity, index) => {
    if (claimValues(entity, 'P31').some((t) => NOT_AN_ENTITY.has(t))) return;
    const names = LANGS.flatMap((l) => [entity.labels?.[l]?.value, ...(entity.aliases?.[l] ?? []).map((a) => a.value)])
      .filter((n): n is string => !!n)
      .map(norm);
    const nameScore = names.includes(q) ? 3 : names.some((n) => ` ${n} `.includes(` ${q} `)) ? 1 : 0;
    if (!nameScore) return;
    const links = candidateLinks(entity, domain);
    if (!links.length) return;
    const catalog = CATALOG[domain];
    const inCatalog = catalog?.props.some(([p]) => claimValues(entity, p).length > 0) ? 3 : 0;
    const fits = describedDomain(description(entity)) === target ? 2 : 0;
    const score = nameScore + inCatalog + fits + Math.min(links.length, MAX_LINKS) * 0.5 - index * 0.5;
    if (!best || score > best.score) best = { entity, score };
  });
  return (best as { entity: WikidataEntity } | null)?.entity ?? null;
}

export function summarize(entity: WikidataEntity): EntityLinks['entity'] {
  return { id: entity.id, label: label(entity), description: description(entity) };
}

/**
 * Fandom no deja pasar comprobaciones automáticas por la web, pero sí por su API: de la URL de un
 * artículo o de la wiki, la consulta que confirma que existe.
 */
export function fandomCheck(url: string): string | null {
  const m = /^(https:\/\/[a-z0-9-]+\.fandom\.com(?:\/[a-z-]{2,5})?)\/(?:wiki\/(.+))?$/i.exec(url);
  if (!m) return null;
  const params: Record<string, string> = m[2] ? { action: 'query', titles: decodeURIComponent(m[2]), format: 'json' } : { action: 'query', meta: 'siteinfo', format: 'json' };
  return `${m[1]}/api.php?${new URLSearchParams(params)}`;
}

/** Lo que la API de Fandom dice de la consulta de `fandomCheck`: la wiki responde y la página no falta. */
async function fandomExists(api: string, fetcher: typeof fetch, timeoutMs: number, headers: Record<string, string>) {
  try {
    const res = await fetcher(api, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return false;
    const body = (await res.json()) as { query?: { general?: unknown; pages?: Record<string, { missing?: unknown; invalid?: unknown }> } };
    if (body.query?.general) return true;
    const pages = Object.values(body.query?.pages ?? {});
    return pages.length > 0 && pages.every((p) => !('missing' in p) && !('invalid' in p));
  } catch {
    return false;
  }
}

/**
 * ¿La URL responde? HEAD con tiempo límite y, si el sitio no acepta HEAD (403/405/501), un GET
 * corto con `Range`. Vale cualquier 2xx o 3xx (fetch sigue las redirecciones). Fandom, por su API.
 */
export async function verifyUrl(url: string, fetcher: typeof fetch = fetch, timeoutMs = 5000, headers: Record<string, string> = {}): Promise<boolean> {
  const fandom = fandomCheck(url);
  if (fandom) return fandomExists(fandom, fetcher, timeoutMs, headers);
  const attempt = async (method: 'HEAD' | 'GET') => {
    const res = await fetcher(url, {
      method,
      redirect: 'follow',
      headers: method === 'GET' ? { ...headers, Range: 'bytes=0-2047' } : headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    void res.body?.cancel().catch(() => undefined);
    return res.status;
  };
  try {
    const status = await attempt('HEAD');
    if (status >= 200 && status < 400) return true;
    if (![403, 405, 501].includes(status)) return false;
    const retry = await attempt('GET');
    return retry >= 200 && retry < 400;
  } catch {
    return false;
  }
}
