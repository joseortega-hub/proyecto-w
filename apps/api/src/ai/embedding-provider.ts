/** Convierte textos en vectores para pgvector (se usa a partir de la Fase 2). */
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[], purpose: 'document' | 'query'): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER = Symbol('EmbeddingProvider');
