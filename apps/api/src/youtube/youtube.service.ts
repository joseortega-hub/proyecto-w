import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../ai/embedding-provider.js';
import { TEXT_PROVIDER, type TextProvider } from '../ai/text-provider.js';
import { config } from '../config.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions, items, youtubeAccounts, type YouTubeAccountRow } from '../db/schema.js';
import { youtubeDomain } from '../domains/youtube.domain.js';
import { itemEmbeddingText } from '../interview/interview.engine.js';
import { TasteService } from '../taste/taste.service.js';
import { YouTubeAdapter } from './youtube.adapter.js';
import { GoogleOAuth, QuotaExceededError, ReconnectRequiredError, YouTubeApi, YouTubeApiError } from './youtube.client.js';
import { createState, TokenCipher, verifyState } from './youtube.crypto.js';
import { ENRICH_BATCH, enrichSongs } from './youtube.enrich.js';
import type { YouTubeImportState } from './youtube.types.js';

const DOMAIN = youtubeDomain.id;
/** En modo de pruebas, Google caduca los refresh tokens a los 7 días. */
const REFRESH_TTL_MS = 7 * 24 * 3600_000;
const EMBED_BATCH = 50;
/** Margen bajo el límite por minuto de los embeddings gratuitos (100 textos). */
const EMBED_TEXTS_PER_MINUTE = 80;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isDailyQuota = (e: unknown) => /per.?day|PerDay/i.test(String((e as Error)?.message ?? e));

export type Privacy = 'private' | 'unlisted' | 'public';

/**
 * "Conectar YouTube": OAuth de Google por persona anónima, importación de su música
 * (YouTubeAdapter → atributos con IA → embeddings) y creación de listas en su cuenta.
 */
@Injectable()
export class YouTubeService {
  private readonly logger = new Logger('YouTube');
  private readonly oauth = new GoogleOAuth(config.googleClientId, config.googleClientSecret);
  private cipherInstance: TokenCipher | null = null;
  /** Importaciones en marcha en este proceso (una por persona). */
  private readonly running = new Set<string>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(TEXT_PROVIDER) private readonly text: TextProvider,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    private readonly tastes: TasteService,
  ) {}

  private get cipher(): TokenCipher {
    this.cipherInstance ??= new TokenCipher(config.tokenEncryptionKey);
    return this.cipherInstance;
  }

  private assertConfigured() {
    if (!this.oauth.configured) throw new ServiceUnavailableException('Falta configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET');
  }

  /** URL de consentimiento de Google y el nonce que la web guarda en una cookie HttpOnly. */
  authStart(userId: string) {
    this.assertConfigured();
    const { state, value } = createState(this.cipher, userId);
    return { url: this.oauth.authUrl(config.googleRedirectUri, value), nonce: state.nonce };
  }

  /** Origen de la web (la redirección llega por su proxy `/api`), para volver tras OAuth. */
  webOrigin() {
    return new URL(config.googleRedirectUri).origin;
  }

  /**
   * Vuelta de Google: comprueba el `state` (firma, caducidad y cookie del navegador),
   * cambia el código por tokens, los guarda cifrados y lanza la importación.
   */
  async callback(code: string, stateValue: string, cookieNonce: string | undefined): Promise<string> {
    this.assertConfigured();
    const state = verifyState(this.cipher, stateValue, cookieNonce);
    const tokens = await this.oauth.exchangeCode(code, config.googleRedirectUri);
    if (!tokens.refreshToken) throw new Error('Google no ha devuelto un refresh token');
    const api = new YouTubeApi(async () => tokens.accessToken);
    const channel = await api
      .get<{ items?: { id: string; snippet?: { title?: string } }[] }>('channels', { part: 'snippet', mine: true })
      .then((r) => r.items?.[0])
      .catch(() => undefined);
    const values = {
      channelId: channel?.id ?? null,
      channelTitle: channel?.snippet?.title ?? null,
      refreshToken: this.cipher.encrypt(tokens.refreshToken),
      accessToken: this.cipher.encrypt(tokens.accessToken),
      accessExpiresAt: tokens.expiresAt,
      status: 'connected' as const,
      connectedAt: new Date(),
      updatedAt: new Date(),
    };
    await this.db
      .insert(youtubeAccounts)
      .values({ userId: state.user, ...values })
      .onConflictDoUpdate({ target: youtubeAccounts.userId, set: values });
    this.logger.log(`Cuenta conectada${channel?.snippet?.title ? ` (${channel.snippet.title})` : ''}`);
    void this.startImport(state.user).catch(() => undefined);
    return state.user;
  }

  async status(userId: string) {
    const account = await this.account(userId);
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(items)
      .where(and(eq(items.domainId, DOMAIN), eq(items.ownerId, userId)));
    let importState = account?.importState ?? null;
    // Una importación "en marcha" que este proceso no conoce se cortó con un reinicio.
    if (importState?.status === 'running' && !this.running.has(userId)) {
      importState = { ...importState, status: 'error', error: 'La importación se cortó (se reinició el servidor). Vuelve a lanzarla.' };
    }
    return {
      configured: this.oauth.configured,
      status: account ? account.status : ('disconnected' as const),
      channelTitle: account?.channelTitle ?? null,
      connectedAt: account?.connectedAt.toISOString() ?? null,
      /** Fecha aproximada en que Google pedirá volver a conectar (modo de pruebas). */
      expiresAt: account ? new Date(account.connectedAt.getTime() + REFRESH_TTL_MS).toISOString() : null,
      itemCount: count,
      import: importState,
    };
  }

  /**
   * Lanza la importación en segundo plano; la web sigue el progreso con `status`.
   * Con `playlistIds`, solo esas listas (importar o reimportar las que elija la persona).
   */
  async startImport(userId: string, playlistIds?: string[]) {
    const account = await this.account(userId);
    if (!account) throw new BadRequestException('Conecta antes tu cuenta de YouTube');
    if (account.status === 'expired') throw reconnect();
    if (!this.running.has(userId)) {
      this.running.add(userId);
      void this.runImport(userId, account.importState?.playlists ?? {}, playlistIds).finally(() => this.running.delete(userId));
    }
    return this.status(userId);
  }

  /** Listas propias de la persona, las más recientes primero, con cuándo se importó cada una (1-2 unidades de cuota). */
  async playlists(userId: string) {
    const account = await this.account(userId);
    if (!account) throw new BadRequestException('Conecta antes tu cuenta de YouTube');
    const imported = account.importState?.playlists ?? {};
    const lists = await this.guard(new YouTubeAdapter(this.api(userId)).listPlaylists(), userId);
    return {
      playlists: lists.map((p) => ({ ...p, importedAt: imported[p.id]?.importedAt ?? null, songs: imported[p.id]?.songs ?? null })),
    };
  }

  /** Revoca el permiso en Google y borra los tokens y la música importada de esta persona. */
  async disconnect(userId: string) {
    const account = await this.account(userId);
    if (account) await this.oauth.revoke(this.cipher.decrypt(account.refreshToken)).catch(() => undefined);
    await this.db.delete(youtubeAccounts).where(eq(youtubeAccounts.userId, userId));
    const removed = await this.db
      .delete(items)
      .where(and(eq(items.domainId, DOMAIN), eq(items.ownerId, userId)))
      .returning({ id: items.id });
    this.tastes.forgetVocabulary(DOMAIN, userId);
    this.logger.log(`Cuenta desconectada: ${removed.length} canciones borradas`);
    return { disconnected: true, removed: removed.length };
  }

  /**
   * Crea en la cuenta de YouTube de la persona la lista de un resultado (privada por
   * defecto). Cuesta 50 unidades la lista y 50 cada canción. Si ya existe, la devuelve.
   */
  async savePlaylist(userId: string, sessionId: string, privacy: Privacy = 'private') {
    const [session] = await this.db.select().from(interviewSessions).where(eq(interviewSessions.id, sessionId));
    if (!session || session.domainId !== DOMAIN || session.userId !== userId) throw new NotFoundException('Lista no encontrada');
    if (!session.result) throw new BadRequestException('Esta entrevista todavía no tiene lista');
    if (session.result.youtube) return { ...session.result.youtube, added: session.result.entries.length, failed: 0, existing: true };

    const ids = session.result.entries.map((e) => e.itemId);
    const rows = await this.db
      .select({ id: items.id, externalId: items.externalId })
      .from(items)
      .where(and(inArray(items.id, ids), eq(items.ownerId, userId)));
    const videoIds = ids.flatMap((id) => rows.find((r) => r.id === id)?.externalId ?? []);
    if (!videoIds.length) throw new BadRequestException('La lista no tiene canciones de YouTube');

    const api = this.api(userId);
    const summary = session.profile?.summary.join(', ');
    const playlist = await this.guard(
      api.insert<{ id: string }>(
        'playlists',
        { part: 'snippet,status' },
        {
          snippet: {
            title: `${session.result.title} · Sintonía`.slice(0, 150),
            description: `Lista creada con Sintonía a partir de una entrevista${summary ? `: ${summary}` : ''}.`.slice(0, 4900),
          },
          status: { privacyStatus: privacy },
        },
      ),
      userId,
    );
    let added = 0;
    for (const videoId of videoIds) {
      try {
        await this.guard(
          api.insert('playlistItems', { part: 'snippet' }, { snippet: { playlistId: playlist.id, resourceId: { kind: 'youtube#video', videoId } } }),
          userId,
        );
        added++;
      } catch (error) {
        // Un vídeo retirado no debe tumbar la lista; la cuota o la sesión caducada, sí.
        if (!(error instanceof NotFoundException || error instanceof YouTubeApiError)) throw error;
        this.logger.warn(`No se pudo añadir ${videoId}: ${(error as Error).message.slice(0, 120)}`);
      }
    }
    const youtube = { playlistId: playlist.id, url: `https://music.youtube.com/playlist?list=${playlist.id}` };
    await this.db
      .update(interviewSessions)
      .set({ result: sql`${interviewSessions.result} || ${JSON.stringify({ youtube })}::jsonb`, updatedAt: new Date() })
      .where(eq(interviewSessions.id, sessionId));
    this.logger.log(`Lista creada en YouTube con ${added}/${videoIds.length} canciones (${api.quotaUnits} unidades)`);
    return { ...youtube, added, failed: videoIds.length - added, existing: false };
  }

  // ——— Importación ———

  private async runImport(userId: string, previousPlaylists: NonNullable<YouTubeImportState['playlists']>, playlistIds?: string[]) {
    const state: YouTubeImportState = {
      status: 'running',
      step: 'Conectando con YouTube',
      found: 0,
      added: 0,
      analyzed: 0,
      embedded: 0,
      pending: 0,
      quotaUnits: 0,
      playlists: previousPlaylists,
      startedAt: new Date().toISOString(),
    };
    const api = this.api(userId);
    const save = (patch: Partial<YouTubeImportState> = {}) => {
      Object.assign(state, patch, { quotaUnits: api.quotaUnits });
      return this.db.update(youtubeAccounts).set({ importState: { ...state }, updatedAt: new Date() }).where(eq(youtubeAccounts.userId, userId));
    };
    try {
      await save();
      const adapter = new YouTubeAdapter(api);
      const imported = await adapter.fetchItems({ limit: config.youtubeImportLimit, playlistIds, onProgress: (step) => void save({ step }) });
      const now = new Date().toISOString();
      const playlists = { ...previousPlaylists };
      for (const [id, { title, songs }] of adapter.playlistsRead) playlists[id] = { title, songs, importedAt: now };
      await save({ found: imported.length, likedMusicPlaylist: playlistIds ? undefined : adapter.likedMusicPlaylist, playlists, step: 'Guardando tus canciones' });
      this.logger.log(`${imported.length} canciones encontradas (LM: ${adapter.likedMusicPlaylist}, ${api.quotaUnits} unidades)`);

      let added = 0;
      for (let i = 0; i < imported.length; i += 200) {
        const chunk = imported.slice(i, i + 200).map(({ classifyHints: _h, ...it }) => ({ ...it, domainId: DOMAIN, ownerId: userId }));
        const rows = await this.db
          .insert(items)
          .values(chunk)
          .onConflictDoUpdate({
            target: [items.domainId, items.source, items.externalId, items.ownerId],
            // Los atributos, estilos e idioma ya deducidos se conservan.
            set: {
              title: sql`excluded.title`,
              subtitle: sql`excluded.subtitle`,
              imageUrl: sql`excluded.image_url`,
              durationSec: sql`excluded.duration_sec`,
              popularity: sql`excluded.popularity`,
            },
          })
          .returning({ inserted: sql<boolean>`(xmax = 0)` });
        added += rows.filter((r) => r.inserted).length;
      }
      await save({ added });

      const hints = new Map(imported.map((it) => [it.externalId, it.classifyHints ?? null]));
      await this.analyze(userId, hints, save);
      this.tastes.forgetVocabulary(DOMAIN, userId);
      await this.embed(userId, save);
      await save({ status: 'done', step: 'Listo', finishedAt: new Date().toISOString() });
      this.logger.log(`Importación terminada: ${state.found} canciones, ${state.added} nuevas, ${state.pending} pendientes`);
    } catch (error) {
      if (error instanceof ReconnectRequiredError) await this.markExpired(userId);
      const message = error instanceof HttpException ? String((error.getResponse() as { message?: string }).message ?? error.message) : (error as Error).message;
      this.logger.warn(`Importación fallida: ${message}`);
      await save({ status: 'error', error: message, finishedAt: new Date().toISOString() }).catch(() => undefined);
    }
  }

  /** Atributos, estilos e idioma con IA para las canciones que aún no los tienen. */
  private async analyze(userId: string, hints: Map<string, string | null>, save: (p: Partial<YouTubeImportState>) => Promise<unknown>) {
    const pending = await this.db
      .select({ id: items.id, externalId: items.externalId, title: items.title, subtitle: items.subtitle })
      .from(items)
      .where(and(eq(items.domainId, DOMAIN), eq(items.ownerId, userId), sql`${items.attributes} = '{}'::jsonb`));
    let analyzed = 0;
    let failures = 0;
    for (let i = 0; i < pending.length; i += ENRICH_BATCH) {
      await save({ step: `Analizando tus canciones con IA (${i}/${pending.length})`, analyzed });
      const batch = pending.slice(i, i + ENRICH_BATCH);
      // Ids cortos en el prompt: menos tokens y menos riesgo de que el modelo los cambie.
      const songs = batch.map((s, k) => ({ id: `c${k + 1}`, title: s.title, artist: s.subtitle, hints: hints.get(s.externalId) ?? null }));
      const result = await enrichSongs(this.text, songs).catch((error: Error) => {
        this.logger.warn(`Lote sin analizar: ${error.message.slice(0, 160)}`);
        return null;
      });
      if (!result) {
        // Dos lotes seguidos sin respuesta: el proveedor no está; se reanuda en la próxima importación.
        if (++failures >= 2) break;
        continue;
      }
      failures = 0;
      for (const [k, s] of batch.entries()) {
        const found = result.get(`c${k + 1}`);
        if (!found) continue;
        await this.db
          .update(items)
          .set({
            attributes: found.attributes,
            tags: found.tags,
            facets: sql`${items.facets} || ${JSON.stringify({ language: found.language })}::jsonb`,
          })
          .where(eq(items.id, s.id));
        analyzed++;
      }
    }
    const [{ left }] = await this.db
      .select({ left: sql<number>`count(*)::int` })
      .from(items)
      .where(and(eq(items.domainId, DOMAIN), eq(items.ownerId, userId), sql`${items.attributes} = '{}'::jsonb`));
    await save({ analyzed, pending: left });
  }

  /** Embeddings por lotes con pausas; si se agota el cupo diario, para y queda pendiente. */
  private async embed(userId: string, save: (p: Partial<YouTubeImportState>) => Promise<unknown>) {
    const pending = await this.db
      .select()
      .from(items)
      .where(and(eq(items.domainId, DOMAIN), eq(items.ownerId, userId), isNull(items.embedding), sql`${items.attributes} <> '{}'::jsonb`));
    let embedded = 0;
    for (let i = 0; i < pending.length; i += EMBED_BATCH) {
      await save({ step: `Preparando la búsqueda semántica (${i}/${pending.length})`, embedded });
      const batch = pending.slice(i, i + EMBED_BATCH);
      const started = Date.now();
      let vectors: number[][];
      try {
        vectors = await this.embeddings.embed(
          batch.map((it) => itemEmbeddingText(it, youtubeDomain.config, youtubeDomain.itemNoun)),
          'document',
        );
      } catch (error) {
        this.logger.warn(`Embeddings pendientes (${isDailyQuota(error) ? 'cupo diario agotado' : (error as Error).message.slice(0, 120)})`);
        break;
      }
      await this.db.transaction(async (tx) => {
        for (const [k, it] of batch.entries()) await tx.update(items).set({ embedding: vectors[k] }).where(eq(items.id, it.id));
      });
      embedded += batch.length;
      const pause = (60_000 * batch.length) / EMBED_TEXTS_PER_MINUTE - (Date.now() - started);
      if (i + EMBED_BATCH < pending.length && pause > 0) await sleep(pause);
    }
    const [{ left }] = await this.db
      .select({ left: sql<number>`count(*)::int` })
      .from(items)
      .where(and(eq(items.domainId, DOMAIN), eq(items.ownerId, userId), sql`(${items.embedding} is null or ${items.attributes} = '{}'::jsonb)`));
    await save({ embedded, pending: left });
  }

  // ——— Tokens ———

  private async account(userId: string): Promise<YouTubeAccountRow | undefined> {
    const [row] = await this.db.select().from(youtubeAccounts).where(eq(youtubeAccounts.userId, userId));
    return row;
  }

  /** Cliente de la Data API que renueva el token de acceso cuando caduca. */
  private api(userId: string): YouTubeApi {
    return new YouTubeApi(() => this.accessToken(userId));
  }

  private async accessToken(userId: string): Promise<string> {
    const account = await this.account(userId);
    if (!account) throw new BadRequestException('Conecta antes tu cuenta de YouTube');
    if (account.status === 'expired') throw reconnect();
    let refreshToken: string;
    try {
      if (account.accessToken && account.accessExpiresAt && account.accessExpiresAt.getTime() > Date.now()) {
        return this.cipher.decrypt(account.accessToken);
      }
      refreshToken = this.cipher.decrypt(account.refreshToken);
    } catch {
      // Cambió TOKEN_ENCRYPTION_KEY: los tokens guardados ya no sirven.
      await this.markExpired(userId);
      throw reconnect();
    }
    try {
      const tokens = await this.oauth.refresh(refreshToken);
      await this.db
        .update(youtubeAccounts)
        .set({
          accessToken: this.cipher.encrypt(tokens.accessToken),
          accessExpiresAt: tokens.expiresAt,
          ...(tokens.refreshToken ? { refreshToken: this.cipher.encrypt(tokens.refreshToken) } : {}),
          updatedAt: new Date(),
        })
        .where(eq(youtubeAccounts.userId, userId));
      return tokens.accessToken;
    } catch (error) {
      if (error instanceof ReconnectRequiredError) {
        await this.markExpired(userId);
        throw reconnect();
      }
      throw error;
    }
  }

  private async markExpired(userId: string) {
    await this.db
      .update(youtubeAccounts)
      .set({ status: 'expired', accessToken: null, updatedAt: new Date() })
      .where(eq(youtubeAccounts.userId, userId));
  }

  /** Traduce los errores de YouTube a respuestas HTTP que la web entiende. */
  private async guard<T>(promise: Promise<T>, userId: string): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      if (error instanceof ReconnectRequiredError) {
        await this.markExpired(userId);
        throw reconnect();
      }
      if (error instanceof QuotaExceededError) throw new HttpException(error.message, HttpStatus.TOO_MANY_REQUESTS);
      if (error instanceof YouTubeApiError && error.status === 404) throw new NotFoundException(error.message);
      throw error;
    }
  }
}

/** 401 con `code` para que la web muestre "Vuelve a conectar". */
const reconnect = () =>
  new UnauthorizedException({
    statusCode: 401,
    code: 'youtube_reconnect',
    message: 'Tu conexión con YouTube ha caducado (Google la renueva cada 7 días en modo de pruebas). Vuelve a conectar.',
  });
