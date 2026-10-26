import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { CatalogAdapter } from '../catalog/catalog-adapter.js';
import { mapLimit } from '../catalog/derive.js';
import { OpenLibraryAdapter } from '../catalog/openlibrary.adapter.js';
import { RawgAdapter } from '../catalog/rawg.adapter.js';
import { TmdbAdapter } from '../catalog/tmdb.adapter.js';
import { upsertItems } from '../catalog/upsert.js';
import { config as env } from '../config.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { historyImports, items, type HistoryImportRow } from '../db/schema.js';
import { SeenService } from '../seen/seen.service.js';
import type { SeenMark } from '../seen/seen.js';
import {
  HISTORY_SOURCES,
  HistoryFormatError,
  matchEntry,
  parseGoodreads,
  parseLetterboxd,
  parseSteamProfile,
  steamEntries,
  type CatalogCandidate,
  type HistoryEntry,
  type HistorySource,
} from './history.js';

/** Entradas por paso: cada paso es una petición corta (Render Free corta las largas). */
const BATCH = 25;
/** Búsquedas en directo como mucho por importación; lo demás queda «sin encontrar». */
const LIVE_CAP = 400;
const LIVE_CONCURRENCY = 3;
const CATALOG_TTL_MS = 5 * 60_000;
/** Lo que se enseña de lo no encontrado. */
const MISSING_SHOWN = 1000;

const ADAPTERS: Record<string, () => CatalogAdapter> = {
  movies: () => new TmdbAdapter(env.tmdbApiKey),
  books: () => new OpenLibraryAdapter(env.openLibraryContact),
  games: () => new RawgAdapter(env.rawgApiKey),
};

const label = (e: HistoryEntry) => `${e.title}${e.year ? ` (${e.year})` : ''}${e.author ? ` · ${e.author}` : ''}`;

/**
 * Importa el historial de la persona (Letterboxd, Goodreads o Steam) como «ya visto»: empareja
 * cada entrada con el catálogo y, si no está, la busca en la fuente en directo (por lotes y con
 * tope). El archivo no se guarda: solo título, año, autor y nota de lo pendiente.
 */
@Injectable()
export class HistoryService {
  private readonly logger = new Logger('Historial');
  private readonly catalogs = new Map<string, { at: number; list: CatalogCandidate[] }>();

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly seen: SeenService,
  ) {}

  /** Empieza una importación (y descarta la anterior de esa temática). */
  async start(userId: string, domainId: string, input: { csv?: string; steam?: string }) {
    const source = HISTORY_SOURCES[domainId];
    if (!source) throw new BadRequestException('Esta temática no tiene importación de historial');
    const entries = await this.parse(source, input);
    if (!entries.length) throw new BadRequestException('No hay nada que importar en el archivo');
    await this.db.delete(historyImports).where(and(eq(historyImports.userId, userId), eq(historyImports.domainId, domainId)));
    const [row] = await this.db.insert(historyImports).values({ userId, domainId, source, entries, total: entries.length }).returning();
    this.logger.log(`Importación de ${source} en ${domainId}: ${entries.length} entradas`);
    return this.view(row);
  }

  /** La última importación de la temática (para reanudarla o ver su resumen). */
  async latest(userId: string, domainId: string) {
    const [row] = await this.db
      .select()
      .from(historyImports)
      .where(and(eq(historyImports.userId, userId), eq(historyImports.domainId, domainId)))
      .orderBy(desc(historyImports.createdAt))
      .limit(1);
    return row ? this.view(row) : null;
  }

  /** Procesa el siguiente lote. La web lo llama en bucle hasta `done`; si se corta, se reanuda aquí. */
  async step(userId: string, id: string) {
    const [row] = await this.db.select().from(historyImports).where(and(eq(historyImports.id, id), eq(historyImports.userId, userId)));
    if (!row) throw new NotFoundException('No encuentro esta importación');
    if (row.status === 'done') return this.view(row);
    const batch = row.entries.slice(row.cursor, row.cursor + BATCH);
    const catalog = await this.catalog(row.domainId);
    const marks: SeenMark[] = [];
    const missing: string[] = [];
    const pending: HistoryEntry[] = [];
    for (const entry of batch) {
      const id = matchEntry(entry, catalog);
      if (id) marks.push({ itemId: id, rating: entry.rating });
      else pending.push(entry);
    }
    let live = row.live;
    const adapter = ADAPTERS[row.domainId]?.();
    const budget = Math.max(0, LIVE_CAP - live);
    const searchable = adapter?.lookup ? pending.slice(0, budget) : [];
    missing.push(...pending.slice(searchable.length).map(label));
    live += searchable.length;
    const found = await mapLimit(searchable, LIVE_CONCURRENCY, (entry) => this.findLive(adapter!, row.domainId, entry).catch(() => null));
    searchable.forEach((entry, i) => {
      const id = found[i];
      if (id) marks.push({ itemId: id, rating: entry.rating });
      else missing.push(label(entry));
    });
    const added = await this.seen.markMany(userId, row.domainId, marks, row.source as HistorySource);
    const cursor = row.cursor + batch.length;
    const done = cursor >= row.entries.length;
    const [saved] = await this.db
      .update(historyImports)
      .set({
        cursor,
        found: row.found + marks.length,
        added: row.added + added,
        live,
        missing: [...row.missing, ...missing],
        status: done ? 'done' : 'running',
        // Al terminar no queda nada del archivo, solo el resumen.
        ...(done ? { entries: [] } : {}),
        updatedAt: new Date(),
      })
      .where(eq(historyImports.id, row.id))
      .returning();
    if (done) this.logger.log(`Importación de ${row.source} terminada: ${saved.found} de ${saved.total} encontradas`);
    return this.view(saved);
  }

  private async parse(source: HistorySource, input: { csv?: string; steam?: string }): Promise<HistoryEntry[]> {
    try {
      if (source === 'steam') return steamEntries(await this.steamGames(input.steam ?? ''));
      if (!input.csv?.trim()) throw new BadRequestException('Sube el archivo CSV');
      return source === 'letterboxd' ? parseLetterboxd(input.csv) : parseGoodreads(input.csv);
    } catch (error) {
      if (error instanceof HistoryFormatError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /** Biblioteca de un perfil público de Steam (Steam Web API, `IPlayerService/GetOwnedGames`). */
  private async steamGames(profile: string) {
    if (!env.steamApiKey) throw new HttpException('La importación de Steam no está disponible ahora mismo', HttpStatus.SERVICE_UNAVAILABLE);
    const parsed = parseSteamProfile(profile);
    if (!parsed) throw new BadRequestException('Pega la URL de tu perfil de Steam o tu SteamID');
    const call = async <T>(path: string, params: Record<string, string>) => {
      const url = new URL(`https://api.steampowered.com/${path}`);
      url.search = new URLSearchParams({ key: env.steamApiKey!, format: 'json', ...params }).toString();
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new HttpException('Steam no responde ahora mismo; prueba en un rato', HttpStatus.BAD_GATEWAY);
      return (await res.json()) as T;
    };
    let steamId = 'steamId' in parsed ? parsed.steamId : null;
    if (!steamId && 'vanity' in parsed) {
      const body = await call<{ response: { success: number; steamid?: string } }>('ISteamUser/ResolveVanityURL/v1/', { vanityurl: parsed.vanity });
      steamId = body.response.success === 1 ? (body.response.steamid ?? null) : null;
      if (!steamId) throw new BadRequestException('No encuentro ese perfil de Steam');
    }
    const body = await call<{ response: { games?: { appid: number; name?: string; playtime_forever?: number }[] } }>('IPlayerService/GetOwnedGames/v1/', {
      steamid: steamId!,
      include_appinfo: '1',
      include_played_free_games: '1',
    });
    if (!body.response.games?.length) {
      throw new BadRequestException('No vemos tus juegos: en Steam, pon públicos tu perfil y los «Detalles de los juegos» (Privacidad) y vuelve a intentarlo');
    }
    return body.response.games;
  }

  /** Busca la entrada en la fuente; si no estaba en el catálogo, la guarda. Devuelve su id. */
  private async findLive(adapter: CatalogAdapter, domainId: string, entry: HistoryEntry): Promise<string | null> {
    const hit = await adapter.lookup!(entry);
    if (!hit) return null;
    const [existing] = await this.db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.domainId, domainId), eq(items.source, adapter.source), eq(items.externalId, hit.externalId), eq(items.ownerId, '')));
    if (existing) return existing.id;
    const item = await hit.item();
    if (!item) return null;
    const [id] = await upsertItems(this.db, domainId, [item]);
    // Para las siguientes entradas (otra edición, el mismo juego repetido) ya está en el catálogo.
    this.catalogs.get(domainId)?.list.push({ id, title: item.title, subtitle: item.subtitle ?? null, year: Number(item.facets?.year) || null });
    return id;
  }

  /** Títulos del catálogo público de la temática, para emparejar sin red. */
  private async catalog(domainId: string): Promise<CatalogCandidate[]> {
    const cached = this.catalogs.get(domainId);
    if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.list;
    const rows = await this.db
      .select({ id: items.id, title: items.title, subtitle: items.subtitle, facets: items.facets })
      .from(items)
      .where(and(inArray(items.domainId, [domainId]), eq(items.ownerId, '')));
    const list = rows.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, year: Number(r.facets.year) || null }));
    this.catalogs.set(domainId, { at: Date.now(), list });
    return list;
  }

  private view(row: HistoryImportRow) {
    return {
      id: row.id,
      domainId: row.domainId,
      source: row.source,
      status: row.status,
      total: row.total,
      processed: row.cursor,
      found: row.found,
      added: row.added,
      notFound: row.missing.length,
      missing: row.missing.slice(0, MISSING_SHOWN),
    };
  }
}
