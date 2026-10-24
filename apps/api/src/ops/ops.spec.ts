import { getTableColumns } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import type { DecisionProvider, DecisionQuestion } from '../ai/decision-provider.js';
import { lastChoice } from '../ai/last-choice.js';
import { estimateCost } from '../ai/pricing.js';
import { DecisionChain, TextChain } from '../ai/provider-chain.js';
import { noteUsage, runInTrace, setTraceSink, skipReason, type TraceEvent } from '../ai/trace-context.js';
import { aiTraces } from '../db/schema.js';
import { OpsService } from './ops.service.js';
import { percentile, summarize, type TraceView } from './summary.js';

const SESSION = '3b0f6c2e-8d1a-4c57-9a3e-1f2d4b6a8c0e';
const SECRET = 'texto-privado-de-la-persona-123';
const questions = {
  next: { type: 'choice', instructions: 'Elige', criteria: { energy: 'Energía', voice: 'Voz' } },
} satisfies Record<string, DecisionQuestion>;

const provider = (name: string, behaviour: string | Error): DecisionProvider => ({
  name,
  async decide() {
    if (behaviour instanceof Error) throw behaviour;
    noteUsage({ inputTokens: 120, outputTokens: 30 }, 'gpt-oss-120b');
    return { next: { type: 'choice', choice: behaviour, confidence: 0.8 } } as never;
  },
});

function capture() {
  const events: TraceEvent[] = [];
  setTraceSink((e) => events.push(e));
  return events;
}
afterEach(() => setTraceSink(null));

describe('trazas de la cadena', () => {
  it('anota proveedor, modelo, tokens y por qué se saltó el anterior', async () => {
    const events = capture();
    await runInTrace({ sessionId: SESSION }, () =>
      new DecisionChain([provider('groq:x', new Error('429 rate limit')), provider('laya:y', 'voice')]).decide('estado', questions),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      sessionId: SESSION,
      task: 'choice',
      subject: 'next',
      provider: 'laya',
      ok: true,
      outcome: 'voice',
      inputTokens: 120,
      outputTokens: 30,
      model: 'gpt-oss-120b',
    });
    expect(events[0].skipped).toMatchObject([{ provider: 'groq', reason: 'sin cupo' }]);
  });

  it('si fallan todos, anota la traza fallida', async () => {
    const events = capture();
    await expect(new DecisionChain([provider('a:x', new Error('fetch failed'))]).decide('e', questions)).rejects.toThrow();
    expect(events[0]).toMatchObject({ ok: false, provider: null });
    expect(events[0].skipped[0].reason).toBe('caído');
  });

  it('NUNCA guarda el texto de la persona ni el state', async () => {
    const events = capture();
    const state = { textoInicial: SECRET, respuestas: [SECRET] };
    await runInTrace({ sessionId: SESSION }, () => new DecisionChain([provider('a:m', 'energy')]).decide(state, questions));
    await runInTrace({ sessionId: SESSION }, () =>
      new TextChain([{ name: 'a:m', write: async () => ({ ok: true }) as never }]).write({ system: SECRET, prompt: SECRET, schema: {} as never }),
    );
    expect(JSON.stringify(events)).not.toContain(SECRET);
    // El estado solo vive en memoria, para la comparativa, y caduca.
    expect(lastChoice(SESSION)?.state).toEqual(state);
    expect(lastChoice(SESSION, Date.now() + 16 * 60_000)).toBeNull();
    // Y la tabla no tiene dónde guardar texto libre más allá de metadatos.
    expect(Object.keys(getTableColumns(aiTraces))).not.toEqual(expect.arrayContaining(['state', 'prompt', 'text', 'initialText']));
  });
});

describe('resumen', () => {
  const row = (provider: string, latencyMs: number, extra: Partial<TraceView> = {}): TraceView => ({
    id: '1', at: '', task: 'choice', subject: 'next', provider, model: null, ok: true, skipped: [], latencyMs, totalMs: latencyMs,
    inputTokens: null, outputTokens: null, listCostEur: 0.01, free: true, outcome: null, ...extra,
  });

  it('mediana, p95, respaldos y coste', () => {
    const rows = [row('groq', 300), row('groq', 500), row('groq', 900), row('laya', 1200, { skipped: [{ provider: 'groq', reason: 'sin cupo', ms: 5 }] })];
    const s = summarize(rows);
    expect(s.calls).toBe(4);
    expect(s.fallbackPct).toBe(25);
    expect(s.medianMs).toBe(500);
    expect(s.p95Ms).toBe(1200);
    expect(s.byProvider[0]).toMatchObject({ provider: 'groq', calls: 3 });
    expect(s.listCostEur).toBeCloseTo(0.04);
    expect(s.paidEur).toBe(0);
  });

  it('percentil de lista vacía', () => expect(percentile([], 95)).toBe(0));
});

describe('precios y motivos', () => {
  it('plan gratuito: coste de lista pero gratis; Jev de pago', () => {
    expect(estimateCost('groq', 'gpt-oss-120b', 1_000_000, 0)).toMatchObject({ free: true });
    expect(estimateCost('groq', 'gpt-oss-120b', 1_000_000, 0).listEur).toBeGreaterThan(0);
    expect(estimateCost('laya', null, 1000, 1000).listEur).toBe(0);
    expect(estimateCost('jev', null, 1000, 1000).free).toBe(false);
  });

  it('clasifica los motivos', () => {
    expect(skipReason(new Error('503 high demand'))).toBe('saturado');
    expect(skipReason(new Error('Failed to generate JSON'))).toBe('JSON mal formado');
    expect(skipReason(Object.assign(new Error('x'), { name: 'TimeoutError' }))).toBe('timeout');
  });
});

describe('límite de la comparativa', () => {
  it('como mucho una cada 30 s', async () => {
    const fast = provider('groq:x', 'voice');
    const ops = new OpsService({} as never, [{ name: 'groq', provider: fast }], {} as never, {} as never);
    setTraceSink(null);
    await runInTrace({ sessionId: SESSION }, () => new DecisionChain([fast]).decide(SECRET, questions));
    const first = await ops.compare(SESSION);
    expect(first.rows[0]).toMatchObject({ provider: 'groq', choice: 'voice', agrees: true });
    await expect(ops.compare(SESSION)).rejects.toMatchObject({ status: 429 });
  });
});
