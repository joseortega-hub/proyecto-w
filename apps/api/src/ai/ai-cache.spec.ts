import { z } from 'zod';
import { cacheSet, clearAiCacheMemory, decisionKey, setAiCacheStore, stableStringify, textKey, type AiCacheStore, type CachedAnswer } from './ai-cache.js';
import type { DecisionProvider, DecisionQuestion } from './decision-provider.js';
import { DecisionChain, TextChain } from './provider-chain.js';
import { setTraceSink, type TraceEvent } from './trace-context.js';
import type { TextProvider } from './text-provider.js';

const questions = {
  next: { type: 'choice', instructions: 'Elige la siguiente pregunta', criteria: { energy: 'Energía', voice: 'Voz' } },
} satisfies Record<string, DecisionQuestion>;

let calls = 0;
const groq: DecisionProvider = {
  name: 'groq:openai/gpt-oss-120b',
  async decide() {
    calls++;
    return { next: { type: 'choice', choice: 'voice', confidence: 0.8 } } as never;
  },
};

const events: TraceEvent[] = [];
beforeEach(() => {
  calls = 0;
  events.length = 0;
  clearAiCacheMemory();
  setAiCacheStore(null);
  setTraceSink((e) => events.push(e));
});
afterEach(() => setTraceSink(null));

describe('claves de la caché', () => {
  it('no dependen del orden de las claves y cambian con el estado', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stableStringify({ a: [2, { c: 2, d: 1 }], b: 1 }));
    expect(decisionKey({ a: 1, b: 2 }, questions)).toBe(decisionKey({ b: 2, a: 1 }, questions));
    expect(decisionKey('quiero algo tranquilo', questions)).not.toBe(decisionKey('quiero algo fiestero', questions));
  });

  it('el texto de la persona solo aparece dentro del hash', () => {
    const key = decisionKey('mi secreto: me llamo Paula', questions);
    expect(key).toMatch(/^d:[0-9a-f]{64}$/);
    expect(key).not.toContain('Paula');
    const t = textKey({ system: 's', prompt: 'mi secreto', schema: z.object({ a: z.string() }) });
    expect(t).toMatch(/^t:[0-9a-f]{64}$/);
    expect(t).not.toBe(textKey({ system: 's', prompt: 'mi secreto', schema: z.object({ b: z.string() }) }));
  });
});

describe('caché de decisiones', () => {
  it('la segunda vez no llama al proveedor y la traza dice "caché" con el ahorro', async () => {
    const chain = new DecisionChain([groq]);
    const first = await chain.decide('ánimo tranquilo', questions);
    await new Promise((r) => setTimeout(r, 0));
    const second = await chain.decide('ánimo tranquilo', questions);
    expect(calls).toBe(1);
    expect(second).toEqual(first);
    const hit = events.at(-1)!;
    expect(hit).toMatchObject({ provider: 'caché', ok: true, outcome: 'voice' });
    expect(hit.model).toContain('groq');
    expect(hit.latencyMs).toBeLessThan(50);
  });

  it('un estado distinto no acierta', async () => {
    const chain = new DecisionChain([groq]);
    await chain.decide('uno', questions);
    await chain.decide('dos', questions);
    expect(calls).toBe(2);
  });

  it('guarda y lee del almacén (sobrevive a un reinicio) y un fallo del almacén no rompe nada', async () => {
    const rows = new Map<string, CachedAnswer>();
    const store: AiCacheStore = {
      get: async (k) => rows.get(k) ?? null,
      set: async (k, a) => void rows.set(k, a),
    };
    setAiCacheStore(store);
    await new DecisionChain([groq]).decide('x', questions);
    await new Promise((r) => setTimeout(r, 0));
    expect(rows.size).toBe(1);
    clearAiCacheMemory(); // "reinicio": solo queda lo de la BD
    await new DecisionChain([groq]).decide('x', questions);
    expect(calls).toBe(1);

    clearAiCacheMemory();
    setAiCacheStore({ get: async () => Promise.reject(new Error('BD caída')), set: async () => Promise.reject(new Error('BD caída')) });
    await expect(new DecisionChain([groq]).decide('y', questions)).resolves.toBeDefined();
    expect(calls).toBe(2);
  });

  it('no cachea cuando fallan todos los proveedores', async () => {
    const roto: DecisionProvider = { name: 'roto', decide: async () => Promise.reject(new Error('fetch failed')) };
    await expect(new DecisionChain([roto]).decide('z', questions)).rejects.toThrow();
    await cacheSet('k', { value: 1, provider: 'a', model: null, inputTokens: null, outputTokens: null }, 1000, 'text', Date.now() - 5000);
    calls = 0;
    await new DecisionChain([groq]).decide('z', questions);
    expect(calls).toBe(1);
  });
});

describe('caché de texto', () => {
  it('repite la misma redacción sin llamar al modelo', async () => {
    let writes = 0;
    const gemini: TextProvider = {
      name: 'gemini:flash',
      async write() {
        writes++;
        return { why: 'Porque te gusta bailar' } as never;
      },
    };
    const schema = z.object({ why: z.string() });
    const chain = new TextChain([gemini]);
    const a = await chain.write({ system: 's', prompt: 'p', schema });
    await new Promise((r) => setTimeout(r, 0));
    const b = await chain.write({ system: 's', prompt: 'p', schema });
    expect(b).toEqual(a);
    expect(writes).toBe(1);
    expect(events.at(-1)?.provider).toBe('caché');
  });
});

describe('resumen de Bajo el capó con caché', () => {
  it('cuenta los aciertos como llamadas, no como gasto, y suma el ahorro', async () => {
    const { summarize } = await import('../ops/summary.js');
    const row = (provider: string, listCostEur: number, inputTokens: number) => ({
      id: provider + inputTokens,
      at: '',
      task: 'choice',
      subject: 'next',
      provider,
      model: null,
      ok: true,
      skipped: [],
      latencyMs: 5,
      totalMs: 5,
      inputTokens,
      outputTokens: 10,
      listCostEur,
      free: true,
      outcome: null,
    });
    const s = summarize([row('groq', 0.001, 300), row('caché', 0.002, 500), row('caché', 0.002, 500)]);
    expect(s).toMatchObject({ calls: 3, cacheHits: 2, cacheHitPct: 67, inputTokens: 300, savedTokens: 1020 });
    expect(s.listCostEur).toBeCloseTo(0.001);
    expect(s.savedEur).toBeCloseTo(0.004);
  });
});
