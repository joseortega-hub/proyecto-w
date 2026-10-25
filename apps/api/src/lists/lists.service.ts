import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import type { Db } from '../db/client.js';
import { items, interviewSessions } from '../db/schema.js';
import { visibleTo } from '../items/items.service.js';
import { InterviewService } from '../interview/interview.service.js';
import { TuningService } from '../interview/tuning.service.js';
import type { ResultEntry } from '../interview/interview.types.js';

/**
 * Orden final de una lista tras editarla: se conservan las entradas que ya estaban (con su encaje y
 * su explicación) y las canciones añadidas entran sin encaje ni explicación. Pura, para poder probarla.
 */
export function applyOrder(current: ResultEntry[], itemIds: string[]): ResultEntry[] {
  const byId = new Map(current.map((e) => [e.itemId, e]));
  const seen = new Set<string>();
  const out: ResultEntry[] = [];
  for (const id of itemIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(byId.get(id) ?? { itemId: id, match: 0, fit: null, reason: '' });
  }
  return out;
}

@Injectable()
export class ListsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly interviews: InterviewService,
    private readonly tuning: TuningService,
  ) {}

  /** Guarda el orden y los elementos de la lista de una sesión. Solo su dueño (si la sesión tiene uno). */
  async setEntries(sessionId: string, itemIds: string[], userId: string | null) {
    const session = await this.interviews.load(sessionId);
    if (!session.result) throw new BadRequestException('Esta entrevista todavía no tiene lista');
    if (session.userId && session.userId !== userId) throw new ForbiddenException('Esta lista es de otra persona');

    const known = new Set(session.result.entries.map((e) => e.itemId));
    const added = [...new Set(itemIds)].filter((id) => !known.has(id));
    if (added.length) {
      // Solo canciones de la misma temática y visibles para esta persona (las suyas o las públicas).
      const visible = await this.db
        .select({ id: items.id })
        .from(items)
        .where(and(inArray(items.id, added), eq(items.domainId, session.domainId), visibleTo(userId)));
      if (visible.length !== added.length) throw new BadRequestException('Alguna canción no existe en esta temática');
    }

    const entries = applyOrder(session.result.entries, itemIds);
    // La lista original de "Tu vibra" deja de valer como punto de vuelta: ahora es la editada.
    const result = { ...session.result, entries, vibe: session.result.vibe ? { ...session.result.vibe, original: entries } : null };
    await this.db.update(interviewSessions).set({ result, updatedAt: new Date() }).where(eq(interviewSessions.id, session.id));
    return this.tuning.result(sessionId);
  }
}
