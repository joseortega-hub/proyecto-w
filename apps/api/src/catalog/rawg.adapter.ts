import type { Anchor } from '../interview/interview.types.js';
import { anchorMatchesText } from '../interview/anchors.js';
import { bestName, nameQueries } from '../interview/named.js';
import { anchorTag, themeKeywordIds, type CatalogAdapter, type ImportedItem } from './catalog-adapter.js';
import { gameDetails, type ItemDetails } from './item-details.js';
import { clamp, logScale, mapLimit, nudge, politeFetcher, priorAverage } from './derive.js';

interface RawgNamed {
  id: number;
  name: string;
  slug: string;
  language?: string;
}

export interface RawgGame {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  added: number;
  playtime: number;
  metacritic: number | null;
  genres: RawgNamed[];
  tags?: RawgNamed[];
  parent_platforms?: { platform: RawgNamed }[];
  platforms?: { platform: RawgNamed }[];
  esrb_rating?: { slug: string } | null;
}

interface RawgDetail extends RawgGame {
  description_raw?: string;
  developers?: RawgNamed[];
  publishers?: RawgNamed[];
}

/** Géneros de RAWG con los que se siembra el catálogo, más algunas etiquetas para variar. */
export const SEED_GENRES = [
  'action', 'adventure', 'role-playing-games-rpg', 'shooter', 'strategy', 'casual', 'simulation', 'puzzle',
  'platformer', 'racing', 'sports', 'fighting', 'indie', 'arcade', 'family', 'massively-multiplayer',
];
export const SEED_TAGS = ['horror', 'co-op', 'relaxing', 'story-rich', 'roguelike', 'open-world'];

type Scales = { intensity: number; challenge: number; story: number; lightness: number };

const GENRE_PRIORS: Record<string, Partial<Scales>> = {
  action: { intensity: 0.8, challenge: 0.55, story: 0.45, lightness: 0.45 },
  shooter: { intensity: 0.9, challenge: 0.6, story: 0.35, lightness: 0.3 },
  fighting: { intensity: 0.9, challenge: 0.65, story: 0.15, lightness: 0.45 },
  racing: { intensity: 0.8, challenge: 0.45, story: 0.05, lightness: 0.65 },
  sports: { intensity: 0.7, challenge: 0.45, story: 0.05, lightness: 0.7 },
  platformer: { intensity: 0.6, challenge: 0.6, story: 0.3, lightness: 0.7 },
  arcade: { intensity: 0.7, challenge: 0.5, story: 0.1, lightness: 0.7 },
  adventure: { intensity: 0.5, challenge: 0.4, story: 0.75, lightness: 0.5 },
  'role-playing-games-rpg': { intensity: 0.5, challenge: 0.55, story: 0.85, lightness: 0.4 },
  strategy: { intensity: 0.35, challenge: 0.65, story: 0.3, lightness: 0.5 },
  puzzle: { intensity: 0.2, challenge: 0.5, story: 0.2, lightness: 0.7 },
  casual: { intensity: 0.2, challenge: 0.2, story: 0.15, lightness: 0.8 },
  simulation: { intensity: 0.3, challenge: 0.35, story: 0.2, lightness: 0.65 },
  family: { intensity: 0.35, challenge: 0.2, story: 0.25, lightness: 0.9 },
  'board-games': { intensity: 0.2, challenge: 0.45, story: 0.05, lightness: 0.75 },
  card: { intensity: 0.25, challenge: 0.5, story: 0.1, lightness: 0.65 },
  'massively-multiplayer': { intensity: 0.6, challenge: 0.5, story: 0.4, lightness: 0.5 },
};

const INTENSITY = { 'fast-paced': 0.15, fps: 0.1, 'hack-and-slash': 0.1, relaxing: -0.25, atmospheric: -0.05, 'turn-based': -0.15, cozy: -0.2 };
const CHALLENGE = { difficult: 0.3, 'souls-like': 0.35, 'hard': 0.2, roguelike: 0.12, 'roguelite': 0.1, relaxing: -0.25, casual: -0.2, cozy: -0.25 };
const STORY = { 'story-rich': 0.3, 'choices-matter': 0.2, 'visual-novel': 0.25, 'multiple-endings': 0.1, 'great-story': 0.2, 'open-world': 0.05, 'sandbox': -0.1, 'pvp': -0.2, 'online-pvp': -0.2 };
const LIGHTNESS = {
  funny: 0.25, comedy: 0.25, cute: 0.25, colorful: 0.15, cartoon: 0.15, 'family-friendly': 0.2, relaxing: 0.1,
  horror: -0.35, 'survival-horror': -0.2, 'psychological-horror': -0.25, dark: -0.25, gore: -0.25, violent: -0.15,
  'post-apocalyptic': -0.15, zombies: -0.1, 'dark-fantasy': -0.2,
};
const MULTI = ['multiplayer', 'co-op', 'online-co-op', 'local-co-op', 'split-screen', 'online-multiplayer', 'local-multiplayer', 'pvp', 'online-pvp', 'massively-multiplayer', 'mmo'];

/** Atributos de escala del dominio videojuegos a partir de géneros, etiquetas y tiempo de juego. */
export function deriveGameAttributes(game: Pick<RawgGame, 'genres' | 'tags' | 'playtime' | 'esrb_rating'>): Record<string, number> {
  const genres = game.genres.map((g) => g.slug);
  const tags = (game.tags ?? []).map((t) => t.slug);
  const all = [...genres, ...tags];
  const base = priorAverage<keyof Scales>(genres, GENRE_PRIORS, { intensity: 0.5, challenge: 0.45, story: 0.4, lightness: 0.5 });

  const multi = all.some((t) => MULTI.includes(t));
  const single = tags.includes('singleplayer');
  const social = all.includes('massively-multiplayer') ? 0.9 : multi && !single ? 0.85 : multi ? 0.55 : 0.1;

  // RAWG da el tiempo medio de juego en horas (0 si no lo sabe): 80 h o más ya es "largo".
  let length = game.playtime > 0 ? Math.log1p(game.playtime) / Math.log1p(80) : 0.45;
  if (tags.includes('open-world')) length += 0.1;
  if (tags.includes('short')) length -= 0.25;

  const esrb = game.esrb_rating?.slug;
  const rated = esrb === 'mature' || esrb === 'adults-only' ? -0.15 : esrb === 'everyone' || esrb === 'everyone-10-plus' ? 0.1 : 0;

  return {
    intensity: clamp(base.intensity + nudge(tags, INTENSITY)),
    challenge: clamp(base.challenge + nudge(tags, CHALLENGE)),
    story: clamp(base.story + nudge(tags, STORY)),
    social: clamp(social),
    length: clamp(length),
    lightness: clamp(base.lightness + nudge(all, LIGHTNESS) + rated),
  };
}

/** Etiquetas de RAWG que hablan de la tienda o del mando, no del juego. */
const STORE_TAGS = /^(steam|full-controller|partial-controller|controller|achievements|cloud|stats|in-app|includes-|captions|steamvr|valve-anti-cheat|remote-play|family-sharing|console-)/;
export const isStoreTag = (slug: string) => STORE_TAGS.test(slug);

/** Referencia de popularidad para lo que llega por búsqueda en directo (≈ los más añadidos). */
const LIVE_MAX_ADDED = 20_000;

/** Faceta `platforms`:familias de plataforma (pc, playstation, xbox, nintendo, mobile). */
export function platformFacet(game: Pick<RawgGame, 'parent_platforms'>): string[] {
  const map: Record<string, string> = { pc: 'pc', mac: 'pc', linux: 'pc', playstation: 'playstation', xbox: 'xbox', nintendo: 'nintendo', ios: 'mobile', android: 'mobile' };
  return [...new Set((game.parent_platforms ?? []).map((p) => map[p.platform.slug]).filter(Boolean))];
}

/**
 * Videojuegos de RAWG (https://rawg.io/apidocs). Clave gratuita; uso no comercial con
 * atribución y enlace a RAWG en cada página que muestre sus datos. Unas 15 peticiones
 * de listado + una de detalle por juego (descripción y estudio).
 */
export class RawgAdapter implements CatalogAdapter {
  readonly domainId = 'games';
  readonly source = 'rawg';
  private readonly get = politeFetcher({ minIntervalMs: 150, name: 'RAWG' });

  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error('Falta RAWG_API_KEY en .env (https://rawg.io/apidocs)');
  }

  async fetchItems({ limit, onProgress }: { limit: number; onProgress?: (m: string) => void }) {
    const seeds = [...SEED_GENRES.map((g) => ({ genres: g })), ...SEED_TAGS.map((t) => ({ tags: t }))];
    const perSeed = Math.min(40, Math.ceil((limit * 1.4) / seeds.length));
    const byId = new Map<number, RawgGame>();
    for (const seed of seeds) {
      const page = await this.get<{ results: RawgGame[] }>(
        this.url('games', { ...seed, page_size: String(perSeed), ordering: '-added', exclude_additions: 'true' }),
      );
      for (const g of page.results) if (!byId.has(g.id) && byId.size < limit) byId.set(g.id, g);
      onProgress?.(`${Object.values(seed)[0]}: ${page.results.length} juegos (total único: ${byId.size})`);
      if (byId.size >= limit) break;
    }

    const games = [...byId.values()];
    const maxAdded = Math.max(...games.map((g) => g.added));
    let done = 0;
    const details = await mapLimit(games, 4, async (g) => {
      const detail = await this.get<RawgDetail>(this.url(`games/${g.id}`));
      if (++done % 50 === 0) onProgress?.(`detalles: ${done}/${games.length}`);
      return detail;
    });
    return games.map((g, i) => this.toItem({ ...g, ...details[i] }, maxAdded));
  }

  /** Desarrolladora o editora con su nombre real (RAWG ya es aproximado; si no, se prueba por palabras). */
  async resolveName(name: string, kinds: Anchor['kind'][]): Promise<{ name: string; kind: Anchor['kind'] } | null> {
    if (!kinds.includes('studio')) return null;
    const names: { name: string }[] = [];
    for (const search of nameQueries(name).filter((q) => !q.endsWith('*'))) {
      for (const path of ['developers', 'publishers']) {
        const body = await this.get<{ results: { name: string }[] }>(this.url(path, { search, page_size: '8' })).catch(() => ({ results: [] as { name: string }[] }));
        names.push(...body.results);
      }
      if (bestName(name, names)) break;
    }
    const best = bestName(name, names);
    return best ? { name: best.candidate.name, kind: 'studio' } : null;
  }

  /**
   * Búsqueda en directo: por nombre (sagas y títulos, "Pokémon") y, para estudios o
   * creadores ("algo de Nintendo"), por desarrolladora y editora. Lo de búsqueda por nombre
   * solo se queda si el nombre lo contiene de verdad (RAWG busca de forma aproximada).
   */
  async search(anchor: Anchor, limit: number): Promise<ImportedItem[]> {
    /** Varias páginas: "todos los de Nintendo", no los 30 primeros. */
    const list = async (params: Record<string, string>, pages = 1) => {
      const out: RawgGame[] = [];
      for (let page = 1; page <= pages; page++) {
        const body = await this.get<{ results: RawgGame[]; next: string | null }>(this.url('games', { page_size: '40', exclude_additions: 'true', ...params, page: String(page) })).catch(
          () => ({ results: [] as RawgGame[], next: null }),
        );
        out.push(...body.results);
        if (!body.next) break;
      }
      return out;
    };
    const firstId = (path: string) =>
      this.get<{ results: { id: number }[] }>(this.url(path, { search: anchor.label, page_size: '1' }))
        .then((b) => b.results[0]?.id ?? null)
        .catch(() => null);

    const tagged: RawgGame[] = [];
    if (anchor.theme) {
      // Temática: etiquetas de RAWG ("post-apocalyptic", "zombies") por sus palabras clave en inglés.
      const tagIds = await themeKeywordIds(anchor, (q) =>
        this.get<{ results: { id: number; name?: string }[] }>(this.url('tags', { search: q, page_size: '10' }))
          .then((b) => b.results)
          .catch(() => []),
      );
      if (tagIds.length) tagged.push(...(await list({ tags: tagIds.join(','), ordering: '-added' }, 2)));
    } else if (anchor.kind === 'studio' || anchor.kind === 'creator' || anchor.kind === 'franchise') {
      const [developer, publisher] = await Promise.all([firstId('developers'), firstId('publishers')]);
      if (developer) tagged.push(...(await list({ developers: String(developer), ordering: '-added' }, 2)));
      if (publisher) tagged.push(...(await list({ publishers: String(publisher), ordering: '-added' }, 2)));
    }
    const byName = anchor.theme ? [] : (await list({ search: anchor.label, search_precise: 'true' }, 2)).filter((g) => anchorMatchesText(g.name, anchor));

    const byId = new Map<number, { game: RawgGame; tagged: boolean }>();
    for (const g of byName) byId.set(g.id, { game: g, tagged: false });
    for (const g of tagged) if (!byId.has(g.id)) byId.set(g.id, { game: g, tagged: true });
    const found = [...byId.values()].sort((a, b) => b.game.added - a.game.added).slice(0, limit);
    const details = await mapLimit(found, 4, ({ game }) => this.get<RawgDetail>(this.url(`games/${game.id}`)).catch(() => game));
    return found.map(({ game, tagged: isTagged }, i) => {
      const item = this.toItem({ ...game, ...details[i] }, LIVE_MAX_ADDED);
      return isTagged ? { ...item, tags: [...new Set([...(item.tags ?? []), anchorTag(anchor)])] } : item;
    });
  }

  /** Desarrolladora y editora de un juego ya importado (script de relleno de facetas). */
  async entityFacets(externalId: string) {
    return gameEntityFacets(await this.get<RawgDetail>(this.url(`games/${externalId}`)));
  }

  private url(path: string, params: Record<string, string> = {}) {
    const url = new URL(`https://api.rawg.io/api/${path}`);
    url.search = new URLSearchParams({ key: this.apiKey, ...params }).toString();
    return url;
  }

  /** Estudio, editora y plataformas de un juego ya importado (script de relleno). */
  async details(externalId: string): Promise<ItemDetails> {
    return gameDetails(await this.get<RawgDetail>(this.url(`games/${externalId}`)));
  }

  private toItem(g: RawgDetail, maxAdded: number): ImportedItem {
    // Solo las etiquetas en inglés (RAWG mezcla etiquetas en ruso) y sin las de tienda (logros, nube…).
    const tags = (g.tags ?? [])
      .filter((t) => (!t.language || t.language === 'eng') && !isStoreTag(t.slug))
      .map((t) => t.slug);
    const description = g.description_raw?.replace(/\s+/g, ' ').trim();
    return {
      source: this.source,
      externalId: String(g.id),
      title: g.name,
      subtitle: g.developers?.[0]?.name ?? g.publishers?.[0]?.name ?? g.genres[0]?.name ?? null,
      description: description ? description.slice(0, 700) : null,
      // Versión recortada de la imagen: la original pesa varios megas.
      imageUrl: g.background_image?.replace('/media/', '/media/crop/600/400/') ?? null,
      mediaUrl: null,
      externalUrl: `https://rawg.io/games/${g.slug}`,
      durationSec: null,
      attributes: deriveGameAttributes(g),
      tags: [...new Set([...g.genres.map((x) => x.slug), ...tags])].slice(0, 16),
      popularity: logScale(g.added, maxAdded),
      facets: {
        platforms: platformFacet(g),
        ...gameEntityFacets(g),
        ...(g.released ? { year: g.released.slice(0, 4) } : {}),
      },
      details: gameDetails(g),
    };
  }
}

/** Faceta `companies`: quién desarrolla y quién edita ("Nintendo", "Game Freak"), tal y como lo da RAWG. */
export function gameEntityFacets(g: { developers?: { name: string }[]; publishers?: { name: string }[] }): Record<string, string[]> {
  const companies = [...new Set([...(g.developers ?? []), ...(g.publishers ?? [])].map((c) => c.name))].slice(0, 6);
  return companies.length ? { companies } : {};
}
