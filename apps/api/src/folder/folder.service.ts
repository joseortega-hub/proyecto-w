import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../ai/embedding-provider.js';
import { TEXT_PROVIDER, type TextProvider } from '../ai/text-provider.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { items } from '../db/schema.js';
import { folderDomain } from '../domains/folder.domain.js';
import { itemEmbeddingText } from '../interview/interview.engine.js';
import { MusicBrainzClient } from '../musicbrainz/musicbrainz.client.js';
import { TasteService } from '../taste/taste.service.js';
import { ENRICH_BATCH, enrichSongs } from '../youtube/youtube.enrich.js';
import { identifyTracks, type LocalTrackInput } from './folder.identify.js';

const DOMAIN = folderDomain.id;
const SOURCE = 'local';
const EMBED_BATCH = 50;
const isDailyQuota = (e: unknown) => /per.?day|PerDay/i.test(String((e as Error)?.message ?? e));

/**
 * "Mi carpeta": recibe de la web solo los datos de cada archivo (nunca el audio), los
 * identifica (ID3 → IA → MusicBrainz), deduce atributos con IA y calcula los embeddings.
 * Cada fase es reanudable: `resume` termina lo que quedó pendiente (cupo de la IA agotado…).
 */
@Injectable()
export class FolderService {
  private readonly logger = new Logger('Folder');
  private readonly musicBrainz = new MusicBrainzClient();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(TEXT_PROVIDER) private readonly text: TextProvider,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    private readonly tastes: TasteService,
  ) {}

  private mine(userId: string) {
    return and(eq(items.domainId, DOMAIN), eq(items.ownerId, userId));
  }

  async status(userId: string) {
    const [row] = await this.db
      .select({
        itemCount: sql<number>`count(*)::int`,
        review: sql<number>`(count(*) filter (where ${items.facets}->>'review' = 'yes'))::int`,
        unanalyzed: sql<number>`(count(*) filter (where ${items.attributes} = '{}'::jsonb))::int`,
        unembedded: sql<number>`(count(*) filter (where ${items.embedding} is null and ${items.attributes} <> '{}'::jsonb))::int`,
      })
      .from(items)
      .where(this.mine(userId));
    return row;
  }

  /** Claves ya guardadas: la web solo envía los archivos nuevos y así se puede reanudar. */
  async keys(userId: string): Promise<string[]> {
    const rows = await this.db.select({ key: items.externalId }).from(items).where(this.mine(userId));
    return rows.map((r) => r.key);
  }

  async list(userId: string) {
    const rows = await this.db
      .select({ id: items.id, key: items.externalId, title: items.title, artist: items.subtitle, facets: items.facets })
      .from(items)
      .where(this.mine(userId))
      .orderBy(items.title);
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      artist: r.artist,
      review: r.facets.review === 'yes',
      manual: r.facets.manual === 'yes',
      identified: String(r.facets.identified ?? ''),
    }));
  }

  /** Identifica y guarda un lote de archivos, y deduce sus atributos. */
  async addTracks(userId: string, tracks: LocalTrackInput[]) {
    const identified = await identifyTracks(tracks, { text: this.text, musicBrainz: this.musicBrainz, onWarn: (m) => this.logger.warn(m) });
    if (!identified.length) return { saved: 0, review: 0 };
    await this.db
      .insert(items)
      .values(
        identified.map((t) => ({
          domainId: DOMAIN,
          source: SOURCE,
          externalId: t.key,
          ownerId: userId,
          title: t.title,
          subtitle: t.artist,
          description: null,
          imageUrl: null,
          mediaUrl: 'local:file',
          externalUrl: null,
          durationSec: t.durationSec,
          attributes: {},
          tags: [],
          facets: { identified: t.identified, ...(t.review ? { review: 'yes' } : {}), fileName: t.fileName },
          popularity: 0.5,
        })),
      )
      .onConflictDoUpdate({
        target: [items.domainId, items.source, items.externalId, items.ownerId],
        // Lo corregido a mano no se pisa.
        set: { title: sql`excluded.title`, subtitle: sql`excluded.subtitle`, durationSec: sql`excluded.duration_sec`, facets: sql`excluded.facets` },
        setWhere: sql`${items.facets}->>'manual' is null`,
      });
    await this.analyze(userId, 1);
    this.tastes.forgetVocabulary(DOMAIN, userId);
    return { saved: identified.length, review: identified.filter((t) => t.review).length };
  }

  /** Corrección manual de una canción "por revisar": se vuelve a analizar y a vectorizar. */
  async correct(userId: string, id: string, patch: { title: string; artist: string | null }) {
    const updated = await this.db
      .update(items)
      .set({
        title: patch.title,
        subtitle: patch.artist,
        attributes: {},
        tags: [],
        embedding: null,
        facets: sql`(${items.facets} - 'review') || '{"manual":"yes"}'::jsonb`,
      })
      .where(and(eq(items.id, id), this.mine(userId)))
      .returning({ id: items.id });
    if (!updated.length) throw new NotFoundException('Canción no encontrada');
    await this.analyze(userId, 1);
    this.tastes.forgetVocabulary(DOMAIN, userId);
    return { id, title: patch.title, artist: patch.artist };
  }

  /** Termina lo pendiente: atributos con IA y embeddings. Devuelve lo que queda. */
  async resume(userId: string) {
    await this.analyze(userId, 2);
    const quota = await this.embed(userId);
    this.tastes.forgetVocabulary(DOMAIN, userId);
    return { ...(await this.status(userId)), quota };
  }

  async remove(userId: string) {
    const removed = await this.db.delete(items).where(this.mine(userId)).returning({ id: items.id });
    this.tastes.forgetVocabulary(DOMAIN, userId);
    this.logger.log(`Carpeta olvidada: ${removed.length} canciones borradas`);
    return { removed: removed.length };
  }

  /** Atributos, estilos e idioma con IA (`batches` lotes como máximo). */
  private async analyze(userId: string, batches: number) {
    const pending = await this.db
      .select({ id: items.id, title: items.title, subtitle: items.subtitle, facets: items.facets })
      .from(items)
      .where(and(this.mine(userId), sql`${items.attributes} = '{}'::jsonb`))
      .limit(ENRICH_BATCH * batches);
    for (let i = 0; i < pending.length; i += ENRICH_BATCH) {
      const batch = pending.slice(i, i + ENRICH_BATCH);
      const songs = batch.map((s, k) => ({ id: `c${k + 1}`, title: s.title, artist: s.subtitle, hints: String(s.facets.fileName ?? '') || null }));
      const result = await enrichSongs(this.text, songs).catch((error: Error) => {
        this.logger.warn(`Lote sin analizar: ${error.message.slice(0, 160)}`);
        return null;
      });
      if (!result) return;
      for (const [k, s] of batch.entries()) {
        const found = result.get(`c${k + 1}`);
        if (!found) continue;
        await this.db
          .update(items)
          .set({ attributes: found.attributes, tags: found.tags, facets: sql`${items.facets} || ${JSON.stringify({ language: found.language })}::jsonb` })
          .where(eq(items.id, s.id));
      }
    }
  }

  /** Un lote de embeddings; `true` si falló (p. ej. cupo diario agotado). */
  private async embed(userId: string): Promise<boolean> {
    const pending = await this.db
      .select()
      .from(items)
      .where(and(this.mine(userId), isNull(items.embedding), sql`${items.attributes} <> '{}'::jsonb`))
      .limit(EMBED_BATCH);
    if (!pending.length) return false;
    try {
      const vectors = await this.embeddings.embed(
        pending.map((it) => itemEmbeddingText(it, folderDomain.config, folderDomain.itemNoun)),
        'document',
      );
      await this.db.transaction(async (tx) => {
        for (const [k, it] of pending.entries()) await tx.update(items).set({ embedding: vectors[k] }).where(eq(items.id, it.id));
      });
      return false;
    } catch (error) {
      this.logger.warn(`Embeddings pendientes (${isDailyQuota(error) ? 'cupo diario agotado' : (error as Error).message.slice(0, 120)})`);
      return true;
    }
  }
}
