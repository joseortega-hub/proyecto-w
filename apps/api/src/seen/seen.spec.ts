import { describe, expect, it } from 'vitest';
import { applyFeedback } from '../taste/taste.engine.js';
import { buildBag } from '../interview/candidates.js';
import { mergeMarks } from './seen.js';

describe('ya visto', () => {
  it('«me encantó» pesa más que un 👍 y «meh» es un 👎 suave', () => {
    const up = applyFeedback({}, ['noir'], null, 'up');
    const loved = applyFeedback({}, ['noir'], null, 'loved');
    const meh = applyFeedback({}, ['noir'], null, 'meh');
    const down = applyFeedback({}, ['noir'], null, 'down');
    expect(loved.noir).toBeGreaterThan(up.noir);
    expect(meh.noir).toBeLessThan(0);
    expect(meh.noir).toBeGreaterThan(down.noir);
    expect(applyFeedback(loved, ['noir'], 'loved', null)).toEqual({});
  });

  it('importar sin nota conserva la valoración anterior', () => {
    const merged = mergeMarks(new Map([['a', 'loved' as const]]), [{ itemId: 'a', rating: null }, { itemId: 'b', rating: 'meh' }]);
    expect(merged).toEqual([
      { itemId: 'a', previous: 'loved', next: 'loved', isNew: false },
      { itemId: 'b', previous: null, next: 'meh', isNew: true },
    ]);
  });

  it('lo ya visto queda fuera de la bolsa', () => {
    const item = (id: string) => ({ id, title: id, subtitle: id, tags: [], attributes: {}, facets: {} });
    const config = { tagGroups: [], result: { size: 10 } } as never;
    const bag = buildBag([item('a'), item('b')] as never, { config, signals: {}, anchors: [], exclusions: [], filters: [], seen: new Set(['a']) });
    expect(bag.entries.map((e) => e.id)).toEqual(['b']);
  });
});
