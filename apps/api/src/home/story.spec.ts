import { describe, expect, it } from 'vitest';
import type { DomainConfig } from '../domains/domain.types.js';
import { aiNumbers, learnedView, listsTop } from './story.js';

const config = { tagGroups: [{ key: 'rpg', label: 'rol y aventura', tags: ['rpg'] }] } as unknown as DomainConfig;
const taste = { likes: ['@rpg'], dislikes: [], learned: { rpg: 0.45, shooter: -0.3, x: 0.02 } };

describe('tu historia', () => {
  it('cuenta creadores repetidos, estilos y qué parte va con los gustos', () => {
    const items = [
      { id: '1', subtitle: 'Nintendo', tags: ['rpg'] },
      { id: '2', subtitle: 'Nintendo', tags: ['rpg'] },
      { id: '3', subtitle: 'Valve', tags: ['shooter'] },
    ];
    const t = listsTop(items, config, taste);
    expect(t.creators).toEqual([{ label: 'Nintendo', count: 2 }]);
    expect(t.genres).toEqual([{ label: 'rol y aventura', count: 2 }]);
    expect([t.liked, t.total]).toEqual([2, 3]);
  });

  it('lo aprendido ignora el ruido y separa lo que sube de lo que baja', () => {
    const v = learnedView(taste, { a: 'up', b: 'down', c: 'up' }, config);
    expect(v.up.map((u) => u.label)).toEqual(['rpg']);
    expect(v.down.map((u) => u.label)).toEqual(['shooter']);
    expect([v.thumbsUp, v.thumbsDown]).toEqual([2, 1]);
    expect(v.likes).toEqual(['rol y aventura']);
  });

  it('la IA en números suma llamadas por proveedor y separa lo pagado', () => {
    const n = aiNumbers([
      { provider: 'groq', ok: true, free: true, listCostEur: 0.002 },
      { provider: 'groq', ok: true, free: true, listCostEur: 0.001 },
      { provider: null, ok: false, free: true, listCostEur: 0 },
      { provider: 'jev', ok: true, free: false, listCostEur: 0.01 },
    ]);
    expect(n.calls).toBe(4);
    expect(n.providers[0]).toEqual({ label: 'groq', count: 2 });
    expect(n.paidEur).toBe(0.01);
    expect(n.listCostEur).toBe(0.013);
  });
});
