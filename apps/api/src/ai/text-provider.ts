import type { z } from 'zod';

/** Genera texto para personas (preguntas, motivos, explicaciones) con forma validada. */
export interface TextProvider {
  readonly name: string;
  write<S extends z.ZodType>(request: { system: string; prompt: string; schema: S }): Promise<z.infer<S>>;
}

export const TEXT_PROVIDER = Symbol('TextProvider');
