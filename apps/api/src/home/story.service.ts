import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { aiTraces, interviewSessions, items, tasteProfiles } from '../db/schema.js';
import { DomainsService } from '../domains/domains.service.js';
import { aiNumbers, learnedView, listsTop, type StoryItem } from './story.js';

/** Sesiones recientes que cuentan para el calendario y para el top. */
const SESSION_LIMIT = 400;
/** Las listas más recientes que se miran para el top (hay que traer sus elementos). */
const TOP_LISTS = 60;

@Injectable()
export class StoryService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly domains: DomainsService,
  ) {}

  /** Todo "Tu historia" de una persona anónima, en una sola respuesta. */
  async story(userId: string) {
    const [sessions, tastes, allDomains] = await Promise.all([
      this.db
        .select({
          id: interviewSessions.id,
          domainId: interviewSessions.domainId,
          status: interviewSessions.status,
          createdAt: interviewSessions.createdAt,
          profile: interviewSessions.profile,
          context: interviewSessions.context,
          result: interviewSessions.result,
          textSignals: interviewSessions.textSignals,
        })
        .from(interviewSessions)
        .where(eq(interviewSessions.userId, userId))
        .orderBy(desc(interviewSessions.createdAt))
        .limit(SESSION_LIMIT),
      this.db.select().from(tasteProfiles).where(eq(tasteProfiles.userId, userId)),
      this.domains.list(userId),
    ]);
    const done = sessions.filter((s) => s.status === 'done' && s.result);
    const names = new Map(allDomains.map((d) => [d.id, d]));

    // Calendario: una entrada por lista con perfil; el cliente agrupa por día en su zona horaria.
    const days = done.flatMap((s) =>
      s.profile
        ? [
            {
              id: s.id,
              domainId: s.domainId,
              at: s.createdAt.toISOString(),
              title: s.result!.title,
              scales: s.profile.scales,
              context: {
                franja: s.context.franja ?? null,
                diaSemana: s.context.diaSemana ?? null,
                finDeSemana: s.context.finDeSemana ?? false,
                tiempo: s.context.tiempo?.descripcion ?? null,
              },
            },
          ]
        : [],
    );

    // Top: los elementos de las listas más recientes, por temática.
    const recent = done.slice(0, TOP_LISTS);
    const ids = [...new Set(recent.flatMap((s) => s.result!.entries.map((e) => e.itemId)))];
    const rows: (StoryItem & { domainId: string })[] = ids.length
      ? await this.db
          .select({ id: items.id, domainId: items.domainId, subtitle: items.subtitle, tags: items.tags })
          .from(items)
          .where(inArray(items.id, ids))
      : [];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const tasteBy = new Map(tastes.map((t) => [t.domainId, t]));
    const domainIds = [...new Set(recent.map((s) => s.domainId))];
    const tops = await Promise.all(
      domainIds.map(async (domainId) => {
        const { config } = await this.domains.get(domainId);
        const row = tasteBy.get(domainId);
        const taste = row ? { likes: row.likes, dislikes: row.dislikes, learned: row.learned } : null;
        const entries = recent
          .filter((s) => s.domainId === domainId)
          .flatMap((s) => s.result!.entries.flatMap((e) => (byId.has(e.itemId) ? [byId.get(e.itemId)!] : [])));
        return { domainId, name: names.get(domainId)?.name ?? domainId, ...listsTop(entries, config, taste) };
      }),
    );

    // Lo aprendido, por temática con algo que contar.
    const learned = (
      await Promise.all(
        tastes.map(async (row) => {
          const { config } = await this.domains.get(row.domainId);
          const view = learnedView({ likes: row.likes, dislikes: row.dislikes, learned: row.learned }, row.feedback, config);
          const empty = !view.likes.length && !view.dislikes.length && !view.up.length && !view.down.length;
          return empty ? [] : [{ domainId: row.domainId, name: names.get(row.domainId)?.name ?? row.domainId, ...view }];
        }),
      )
    ).flat();

    // La IA en números: las trazas duran 48 h, las listas y el ahorro de preguntas son de siempre.
    const sessionIds = sessions.map((s) => s.id);
    const traces = sessionIds.length
      ? await this.db
          .select({ provider: aiTraces.provider, ok: aiTraces.ok, free: aiTraces.free, listCostEur: aiTraces.listCostEur })
          .from(aiTraces)
          .where(inArray(aiTraces.sessionId, sessionIds))
      : [];
    const questionsSaved = done.reduce((sum, s) => sum + Object.keys(s.textSignals ?? {}).length, 0);

    const totals = tops.reduce((acc, t) => ({ total: acc.total + t.total, liked: acc.liked + t.liked }), { total: 0, liked: 0 });
    return {
      lists: done.length,
      days,
      top: tops.filter((t) => t.total > 0),
      tasteFit: totals.total ? Math.round((totals.liked / totals.total) * 100) : null,
      learned,
      ai: { ...aiNumbers(traces), lists: done.length, questionsSaved, tracesWindowHours: 48 },
    };
  }
}
