import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, asc, desc, eq, gt, lt } from 'drizzle-orm';
import { CACHE_LABEL } from '../ai/provider-chain.js';
import { estimateCost } from '../ai/pricing.js';
import { setTraceSink, type TraceEvent } from '../ai/trace-context.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { aiTraces, interviewSessions, type AiTraceRow } from '../db/schema.js';
import type { TraceView } from './summary.js';


export const TRACE_RETENTION_MS = 48 * 60 * 60_000;
const CLEANUP_EVERY_MS = 60 * 60_000;

export const toView = (r: AiTraceRow): TraceView => ({
  id: r.id,
  at: r.createdAt.toISOString(),
  task: r.task,
  subject: r.subject,
  provider: r.provider,
  model: r.model,
  ok: r.ok,
  skipped: r.skipped,
  latencyMs: r.latencyMs,
  totalMs: r.totalMs,
  inputTokens: r.inputTokens,
  outputTokens: r.outputTokens,
  listCostEur: r.listCostEur,
  free: r.free,
  outcome: r.outcome,
});

/** Guarda las trazas de IA (solo metadatos) y las borra pasadas 48 h. */
@Injectable()
export class TraceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Trazas');
  private timer?: NodeJS.Timeout;
  private readonly domains = new Map<string, string | null>();

  constructor(@Inject(DB) private readonly db: Db) {}

  onModuleInit() {
    setTraceSink((event) => void this.record(event));
    void this.cleanup();
    this.timer = setInterval(() => void this.cleanup(), CLEANUP_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    setTraceSink(null);
    clearInterval(this.timer);
  }

  async record(event: TraceEvent) {
    try {
      // Un acierto de caché guarda en `model` quién respondió la primera vez ("groq:modelo") y
      // sus tokens: el coste que sale es lo que se ha ahorrado, no lo que se ha gastado.
      const [origin, ...originModel] = (event.provider === CACHE_LABEL ? (event.model ?? '') : '').split(':');
      const cost =
        event.provider === CACHE_LABEL
          ? { ...estimateCost(origin || null, originModel.join(':') || null, event.inputTokens, event.outputTokens), free: true }
          : estimateCost(event.provider, event.model, event.inputTokens, event.outputTokens);
      await this.db.insert(aiTraces).values({
        sessionId: event.sessionId,
        domainId: event.sessionId ? await this.domainOf(event.sessionId) : null,
        task: event.task,
        subject: event.subject.slice(0, 120),
        provider: event.provider,
        model: event.model,
        ok: event.ok,
        skipped: event.skipped,
        latencyMs: event.latencyMs,
        totalMs: event.totalMs,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        listCostEur: cost.listEur,
        free: cost.free,
        outcome: event.outcome?.slice(0, 120) ?? null,
      });
    } catch (error) {
      this.logger.warn(`No he podido guardar una traza: ${(error as Error).message}`);
    }
  }

  private async domainOf(sessionId: string): Promise<string | null> {
    if (this.domains.has(sessionId)) return this.domains.get(sessionId)!;
    const [row] = await this.db.select({ d: interviewSessions.domainId }).from(interviewSessions).where(eq(interviewSessions.id, sessionId));
    if (this.domains.size > 500) this.domains.clear();
    this.domains.set(sessionId, row?.d ?? null);
    return row?.d ?? null;
  }

  async forSession(sessionId: string, since?: Date): Promise<TraceView[]> {
    const rows = await this.db
      .select()
      .from(aiTraces)
      .where(and(eq(aiTraces.sessionId, sessionId), since ? gt(aiTraces.createdAt, since) : undefined))
      .orderBy(asc(aiTraces.createdAt))
      .limit(300);
    return rows.map(toView);
  }

  async recent(limit = 2000): Promise<TraceView[]> {
    const rows = await this.db.select().from(aiTraces).orderBy(desc(aiTraces.createdAt)).limit(limit);
    return rows.map(toView);
  }

  async cleanup(now = new Date()): Promise<number> {
    try {
      const gone = await this.db
        .delete(aiTraces)
        .where(lt(aiTraces.createdAt, new Date(now.getTime() - TRACE_RETENTION_MS)))
        .returning({ id: aiTraces.id });
      if (gone.length) this.logger.log(`Borradas ${gone.length} trazas con más de 48 h`);
      return gone.length;
    } catch (error) {
      this.logger.warn(`No he podido limpiar las trazas: ${(error as Error).message}`);
      return 0;
    }
  }
}
