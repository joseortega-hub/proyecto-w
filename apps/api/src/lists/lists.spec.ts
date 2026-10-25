import { describe, expect, it } from 'vitest';
import { applyOrder } from './lists.service.js';

const entry = (itemId: string, match = 80) => ({ itemId, match, fit: 0.9, reason: `por qué ${itemId}` });

describe('applyOrder', () => {
  it('reordena conservando encaje y explicación', () => {
    const out = applyOrder([entry('a'), entry('b'), entry('c')], ['c', 'a', 'b']);
    expect(out.map((e) => e.itemId)).toEqual(['c', 'a', 'b']);
    expect(out[0].reason).toBe('por qué c');
  });
  it('quita las que ya no están y añade las nuevas al final sin explicación', () => {
    const out = applyOrder([entry('a'), entry('b')], ['b', 'n']);
    expect(out.map((e) => e.itemId)).toEqual(['b', 'n']);
    expect(out[1]).toEqual({ itemId: 'n', match: 0, fit: null, reason: '' });
  });
  it('ignora repetidas', () => {
    expect(applyOrder([entry('a')], ['a', 'a']).length).toBe(1);
  });
});
