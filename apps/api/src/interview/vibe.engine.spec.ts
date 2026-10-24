import { musicDomain } from '../domains/music.domain.js';
import { applyVibe, reorderByVibe, vibeSources } from './vibe.engine.js';
import type { MoodProfile } from './interview.types.js';

const config = { ...musicDomain.config, result: { ...musicDomain.config.result, size: 4, candidates: 10 } };

const track = (id: string, energy: number) => ({
  id,
  subtitle: `artista ${id}`,
  tags: [] as string[],
  popularity: 0,
  attributes: { energy, positivity: 0.5, focus: 0.5, acoustic: 0.5, vocal: 0.5, dance: 0.5 },
});
const pool = Array.from({ length: 10 }, (_, i) => ({ item: track(`t${i}`, i / 9), boost: 0.5 }));
const base: MoodProfile = { scales: { energy: 0.5 }, tagGroups: {}, informed: [], confidence: {}, summary: [] };

describe('Tu vibra', () => {
  it('el origen de cada dimensión: texto, respuesta o suposición', () => {
    const s = vibeSources(config, { textKeys: ['energy'], informed: ['energy', 'vocal'], hasTaste: false, hasContext: true });
    expect(s.energy).toBe('text');
    expect(s.vocal).toBe('answer');
    expect(s.dance).toBe('context');
    expect(vibeSources(config, { textKeys: [], informed: [], hasTaste: true, hasContext: true }).dance).toBe('taste');
    expect(vibeSources(config, { textKeys: [], informed: [], hasTaste: false, hasContext: false }).dance).toBe('guess');
  });

  it('applyVibe pisa la barra, la limita a 0–1 y la da por informada y segura', () => {
    const p = applyVibe(base, { energy: 1.7, nope: 0.2 }, config);
    expect(p.scales.energy).toBe(1);
    expect(p.scales).not.toHaveProperty('nope');
    expect(p.informed).toContain('energy');
    expect(p.confidence?.energy).toBe(1);
    expect(applyVibe(base, undefined, config)).toBe(base);
  });

  it('al subir la energía la lista cambia de verdad y sube la media de energía', () => {
    const calm = reorderByVibe(pool, applyVibe(base, { energy: 0.05 }, config), config, { moved: ['energy'] });
    const wild = reorderByVibe(pool, applyVibe(base, { energy: 0.95 }, config), config, { moved: ['energy'] });
    const avg = (r: typeof calm) => r.reduce((s, x) => s + x.item.attributes.energy, 0) / r.length;
    expect(calm).toHaveLength(4);
    expect(avg(wild)).toBeGreaterThan(avg(calm) + 0.4);
    const overlap = calm.filter((c) => wild.some((w) => w.item.id === c.item.id)).length;
    expect(overlap).toBeLessThan(2);
    expect(calm[0].match).toBeGreaterThanOrEqual(calm[3].match);
  });
});
