import { Inject, Injectable, Logger } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions } from '../db/schema.js';
import { config as env } from '../config.js';
import { DomainsService } from '../domains/domains.service.js';
import { collectContext, contextKey, type ContextRequest, type InterviewContext } from '../interview/interview.context.js';
import { rankCandidates } from '../interview/interview.engine.js';
import { shortReason } from '../interview/anchors.js';
import { ItemsService, publicItem } from '../items/items.service.js';
import { tasteHints } from '../taste/taste.engine.js';
import { TasteService } from '../taste/taste.service.js';
import { comboSlots, comboTitle, contextProfile, pickStable, slotWhy } from './combo.js';

const COMBO_TTL_MS = 30 * 60_000;
const COMBO_CACHE_MAX = 100;
/** Una entrevista sin terminar solo se ofrece para "Continuar" si es reciente. */
const RESUME_MAX_AGE_MS = 2 * 24 * 60 * 60_000;
const RANK_POOL = 12;

export interface ComboView {
  title: string;
  slots: {
    domainId: string;
    role: string;
    why: string;
    entries: { reason: string; item: ReturnType<typeof publicItem> }[];
  }[];
}

export interface DomainActivity {
  domainId: string;
  /** Última lista creada en esta temática. */
  lastList: { sessionId: string; title: string; at: string; count: number } | null;
  /** Entrevista empezada y sin terminar (para «Continuar»). */
  resumeSessionId: string | null;
  /** Listas creadas en total. */
  lists: number;
}

@Injectable()
export class HomeService {
  private readonly logger = new Logger('Hoy');
  private readonly combos = new Map<string, { at: number; value: Promise<ComboView> }>();

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly domains: DomainsService,
    private readonly items: ItemsService,
    private readonly tastes: TasteService,
  ) {}

  /** Contexto, combo y actividad por temática. La actividad solo existe con persona identificada. */
  async summary(userId: string | null, client: ContextRequest) {
    const context = await collectContext(client, {
      timeZone: env.contextTimeZone,
      latitude: env.contextLatitude,
      longitude: env.contextLongitude,
    });
    const [combo, activity] = await Promise.all([
      this.combo(userId, context).catch((error: Error) => {
        this.logger.warn(`Sin combo: ${error.message.slice(0, 120)}`);
        return null;
      }),
      this.activity(userId),
    ]);
    return { context, combo, activity };
  }

  /** Último resultado y entrevista abierta por temática. */
  async activity(userId: string | null): Promise<DomainActivity[]> {
    if (!userId) return [];
    const rows = await this.db
      .select({
        id: interviewSessions.id,
        domainId: interviewSessions.domainId,
        status: interviewSessions.status,
        result: interviewSessions.result,
        updatedAt: interviewSessions.updatedAt,
      })
      .from(interviewSessions)
      .where(eq(interviewSessions.userId, userId))
      .orderBy(desc(interviewSessions.updatedAt))
      .limit(120);
    const out = new Map<string, DomainActivity>();
    const now = Date.now();
    for (const r of rows) {
      const a = out.get(r.domainId) ?? { domainId: r.domainId, lastList: null, resumeSessionId: null, lists: 0 };
      if (r.status === 'done' && r.result) {
        a.lists += 1;
        a.lastList ??= { sessionId: r.id, title: r.result.title, at: r.result.createdAt, count: r.result.entries.length };
      } else if (r.status !== 'done' && !a.resumeSessionId && now - r.updatedAt.getTime() < RESUME_MAX_AGE_MS) {
        a.resumeSessionId = r.id;
      }
      out.set(r.domainId, a);
    }
    return [...out.values()];
  }

  /** Combo con caché por contexto y persona: ni catálogo ni ranking cada vez que se abre la main. */
  combo(userId: string | null, context: InterviewContext): Promise<ComboView> {
    return this.domains.list(userId).then((list) => {
      const available = list.filter((d) => d.itemCount > 0 && d.id !== 'folder').map((d) => d.id);
      const day = new Date().toISOString().slice(0, 10);
      const key = [userId ?? '', contextKey(context), available.join(','), day].join('#');
      const cached = this.combos.get(key);
      if (cached && Date.now() - cached.at < COMBO_TTL_MS) return cached.value;
      const value = this.buildCombo(userId, context, available, `${userId ?? ''}${day}`);
      value.catch(() => this.combos.delete(key));
      if (this.combos.size >= COMBO_CACHE_MAX) this.combos.delete(this.combos.keys().next().value!);
      this.combos.set(key, { at: Date.now(), value });
      return value;
    });
  }

  private async buildCombo(userId: string | null, context: InterviewContext, available: string[], seed: string): Promise<ComboView> {
    const plan = comboSlots(context, available);
    const slots = await Promise.all(
      plan.map(async (slot) => {
        const domain = await this.domains.get(slot.domainId);
        const { config } = domain;
        const profile = contextProfile(context, config);
        const [taste, catalog] = await Promise.all([this.tastes.profile(userId, domain.id).catch(() => null), this.items.catalog(domain.id, [], userId)]);
        const ranked = rankCandidates(catalog, profile, config, RANK_POOL, 1, taste).map((r) => r.item);
        const picks = pickStable(ranked, slot.count, `${seed}${domain.id}`);
        return {
          domainId: domain.id,
          role: slot.role,
          why: slotWhy(context, config, profile),
          entries: picks.map((item) => ({
            reason: shortReason(item, { config, profile, anchors: [], likes: tasteHints(item, taste, config) }),
            item: publicItem(item),
          })),
        };
      }),
    );
    return { title: comboTitle(context), slots: slots.filter((s) => s.entries.length > 0) };
  }
}
