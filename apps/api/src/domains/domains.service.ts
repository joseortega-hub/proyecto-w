import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DB } from '../db/db.module.js';
import type { Db } from '../db/client.js';
import { domains, items } from '../db/schema.js';

export type DomainRow = typeof domains.$inferSelect;

@Injectable()
export class DomainsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list() {
    const [rows, counts] = await Promise.all([
      this.db.select().from(domains),
      this.db.select({ domainId: items.domainId, count: sql<number>`count(*)::int` }).from(items).groupBy(items.domainId),
    ]);
    const countBy = new Map(counts.map((c) => [c.domainId, c.count]));
    return rows.map((domain) => ({
      id: domain.id,
      name: domain.name,
      itemNoun: domain.itemNoun,
      itemNounPlural: domain.itemNounPlural,
      itemCount: countBy.get(domain.id) ?? 0,
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
