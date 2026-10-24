import type { EmbeddingProvider } from './embedding-provider.js';
import { currentSession, emitTrace } from './trace-context.js';

/** Anota cada llamada de embeddings en las trazas (solo cuántos textos, nunca los textos). */
export class TracedEmbeddingProvider implements EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;

  constructor(private readonly inner: EmbeddingProvider) {
    this.name = inner.name;
    this.dimensions = inner.dimensions;
  }

  async embed(texts: string[], purpose: 'document' | 'query'): Promise<number[][]> {
    const [label, ...rest] = this.name.split(':');
    const started = Date.now();
    const base = {
      sessionId: currentSession() ?? null,
      task: 'embedding',
      subject: `${purpose} ×${texts.length}`,
      skipped: [],
      inputTokens: null,
      outputTokens: null,
      outcome: null,
    };
    try {
      const vectors = await this.inner.embed(texts, purpose);
      const ms = Date.now() - started;
      emitTrace({ ...base, provider: label, model: rest.join(':') || null, ok: true, latencyMs: ms, totalMs: ms });
      return vectors;
    } catch (error) {
      emitTrace({ ...base, provider: null, model: null, ok: false, latencyMs: 0, totalMs: Date.now() - started });
      throw error;
    }
  }
}
