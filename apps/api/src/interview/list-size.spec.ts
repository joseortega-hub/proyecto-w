import { describe, expect, it } from 'vitest';
import { normalizeRange, pickBySize, sizeNotice } from './list-size.js';

const items = (matches: number[]) => matches.map((match, i) => ({ id: i, match }));

describe('normalizeRange', () => {
  it('por defecto 10–20 y dentro de 5–50', () => {
    expect(normalizeRange()).toEqual({ min: 10, max: 20 });
    expect(normalizeRange(1, 500)).toEqual({ min: 5, max: 50 });
    expect(normalizeRange(30, 12)).toEqual({ min: 12, max: 30 });
  });
});

describe('pickBySize', () => {
  it('incluye todos los que encajan bien hasta el máximo', () => {
    const { picked, filled } = pickBySize(items(Array(30).fill(90)), { min: 10, max: 20 });
    expect(picked).toHaveLength(20);
    expect(filled).toBe(0);
  });
  it('si hay menos buenos que el mínimo, completa con los mejores restantes y avisa', () => {
    const sorted = items([95, 90, 85, 80, 75, 72, 71, 70, 60, 55, 50]);
    const { picked, good, filled } = pickBySize(sorted, { min: 10, max: 20 });
    expect(good).toBe(8);
    expect(filled).toBe(2);
    expect(picked.map((p) => p.match)).toEqual([95, 90, 85, 80, 75, 72, 71, 70, 60, 55]);
    expect(sizeNotice(good, filled, 'canciones')).toMatch(/Solo 8 canciones.*completo con 2/);
  });
  it('no pasa de 50 aunque se pida más', () => {
    const range = normalizeRange(5, 999);
    expect(pickBySize(items(Array(80).fill(99)), range).picked).toHaveLength(50);
  });
  it('los marcados como pedidos entran aunque encajen poco', () => {
    const sorted = items([30, 95, 90]);
    expect(pickBySize(sorted, { min: 5, max: 5 }, (t) => t.id === 0).picked).toHaveLength(3);
  });
});
