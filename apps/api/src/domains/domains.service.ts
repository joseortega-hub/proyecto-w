import { Inject, Injectable, Logger, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import type { Db } from '../db/client.js';
import { domainAttributes, domains, items } from '../db/schema.js';
import { visibleTo } from '../items/items.service.js';
import { domainDefinitions } from './index.js';

export type DomainRow = typeof domains.$inferSelect;

@Injectable()
export class DomainsService implements OnModuleInit {
  private readonly logger = new Logger('Dominios');

  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * La configuración de los dominios vive en el código: al arrancar se copia a la BD.
   * Así un dominio nuevo (p. ej. "Mi YouTube", sin seed) existe también en producción.
   */
  async onModuleInit() {
    for (const d of domainDefinitions) {
      const row = { id: d.id, name: d.name, itemNoun: d.itemNoun, itemNounPlural: d.itemNounPlural, config: d.config };
      await this.db.transaction(async (tx) => {
        await tx.insert(domains).values(row).onConflictDoUpdate({ target: domains.id, set: row });
        await tx.delete(domainAttributes).where(eq(domainAttributes.domainId, d.id));
        await tx.insert(domainAttributes).values(
          d.config.attributes.map((a, position) => ({
            domainId: d.id,
            key: a.key,
            label: a.label,
            kind: a.kind,
            description: a.description,
            lowLabel: a.lowLabel ?? null,
            highLabel: a.highLabel ?? null,
            position,
          })),
        );
      });
    }
    this.logger.log(`${domainDefinitions.length} dominios sincronizados`);
  }

  /** Temáticas con su número de elementos; en las personales, solo cuentan los de la persona. */
  async list(userId: string | null = null) {
    const [rows, counts] = await Promise.all([
      this.db.select().from(domains),
      this.db
        .select({ domainId: items.domainId, count: sql<number>`count(*)::int` })
        .from(items)
        .where(visibleTo(userId))
        .groupBy(items.domainId),
    ]);
    const countBy = new Map(counts.map((c) => [c.domainId, c.count]));
    const order = new Map(domainDefinitions.map((d, i) => [d.id, i]));
    rows.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
    return rows.map((domain) => ({
      id: domain.id,
      name: domain.name,
      itemNoun: domain.itemNoun,
      itemNounPlural: domain.itemNounPlural,
      itemCount: countBy.get(domain.id) ?? 0,
      gender: domain.config.gender,
      verb: domain.config.verb,
      creatorLabel: domain.config.creatorLabel,
      playable: domain.config.playable,
      personal: domain.config.personal ?? false,
      source: domain.config.source,
      tagGroups: domain.config.tagGroups.map(({ key, label, tags }) => ({ key, label, tags })),
      attributes: domain.config.attributes,
      refinements: domain.config.refinements.map(({ key, label }) => ({ key, label })),
      preferences: (domain.config.preferences ?? []).map(({ key, label, options, anyValue }) => ({ key, label, options, anyValue })),
      interview: domain.config.interview,
    }));
  }

  async get(id: string): Promise<DomainRow> {
    const [row] = await this.db.select().from(domains).where(eq(domains.id, id));
    if (!row) throw new NotFoundException(`No existe el dominio "${id}". ¿Has ejecutado pnpm seed?`);
    return row;
  }
}
