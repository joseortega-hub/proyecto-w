import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { aiCache } from '../db/schema.js';
import { setAiCacheStore, type AiCacheStore, type CachedAnswer } from './ai-cache.js';

const CLEANUP_EVERY_MS = 60 * 60_000;

/** Almacén de la caché de IA en Postgres: sobrevive a reinicios y al sueño de Render. */
@Injectable()
export class AiCacheService implements AiCacheStore, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('CachéIA');
  private timer?: NodeJS.Timeout;

  constructor(@Inject(DB) private readonly db: Db) {}

  onModuleInit() {
    setAiCacheStore(this);
    void this.cleanup();
    this.timer = setInterval(() => void this.cleanup(), CLEANUP_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    setAiCacheStore(null);
    clearInterval(this.timer);
  }

  async get(key: string): Promise<CachedAnswer | null> {
    const [row] = await this.db
      .select({ payload: aiCache.payload })
      .from(aiCache)
      .where(and(eq(aiCache.key, key), gt(aiCache.expiresAt, new Date())));
    return (row?.payload as CachedAnswer | undefined) ?? null;
  }

  async set(key: string, answer: CachedAnswer, ttlMs: number, kind: string): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.db
      .insert(aiCache)
      .values({ key, kind, payload: answer, expiresAt })
      .onConflictDoUpdate({ target: aiCache.key, set: { payload: answer, kind, expiresAt, createdAt: new Date() } });
  }

  async cleanup(): Promise<number> {
    try {
      const gone = await this.db.delete(aiCache).where(lt(aiCache.expiresAt, new Date())).returning({ key: aiCache.key });
      if (gone.length) this.logger.log(`Borradas ${gone.length} respuestas caducadas`);
      return gone.length;
    } catch (error) {
      this.logger.warn(`No he podido limpiar la caché: ${(error as Error).message}`);
      return 0;
    }
  }
}
