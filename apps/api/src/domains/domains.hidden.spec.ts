import { describe, expect, it } from 'vitest';
import type { Db } from '../db/client.js';
import { domains, items, perreoUnlocks } from '../db/schema.js';
import { DomainsService } from './domains.service.js';
import { perreoDomain } from './perreo.domain.js';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

/** BD de mentira con lo justo que usa DomainsService.list/unlock. */
function fakeDb() {
  const unlocked = new Set<string>();
  const base = { id: 'music', name: 'Música', itemNoun: 'canción', itemNounPlural: 'canciones' };
  const rows = [
    { ...base, config: { ...perreoDomain.config, hidden: false } },
    { id: 'perreo', name: 'Modo Perreo', itemNoun: 'canción', itemNounPlural: 'canciones', config: perreoDomain.config },
  ];
  let lastUser = '';
  const db = {
    select: () => ({
      from: (table: unknown) => {
        const result = table === domains ? rows : table === items ? [] : [...unlocked].map((id) => ({ id }));
        const builder = {
          where: () => builder,
          groupBy: () => builder,
          then: (resolve: (v: unknown[]) => unknown) => resolve(table === perreoUnlocks ? result.filter((r) => (r as { id: string }).id === lastUser) : result),
        };
        return builder;
      },
    }),
    insert: () => ({ values: (v: { userId: string }) => ({ onConflictDoNothing: async () => void unlocked.add(v.userId) }) }),
  };
  return { db: db as unknown as Db, as: (u: string) => (lastUser = u) };
}

describe('temática secreta: oculta hasta desbloquearla', () => {
  it('no sale sin desbloquear, aunque se pida con hidden', async () => {
    const { db, as } = fakeDb();
    const service = new DomainsService(db);
    as(userA);
    expect((await service.list(userA, true)).map((d) => d.id)).toEqual(['music']);
    expect((await service.list(null, true)).map((d) => d.id)).toEqual(['music']);
  });

  it('sale después de desbloquearla, solo para esa persona, y las listas internas siguen sin verla', async () => {
    const { db, as } = fakeDb();
    const service = new DomainsService(db);
    as(userA);
    await service.unlock(userA);
    expect((await service.list(userA, true)).map((d) => d.id)).toEqual(['music', 'perreo']);
    expect((await service.list(userA)).map((d) => d.id)).toEqual(['music']); // barra universal, combo, historia…
    as(userB);
    expect((await service.list(userB, true)).map((d) => d.id)).toEqual(['music']);
  });
});
