import { Logger } from '@nestjs/common';
import type { z } from 'zod';
import type { DecisionProvider, DecisionQuestion } from './decision-provider.js';
import { coolDown, isTransient, modelOrder, recover } from './model-fallback.js';
import type { TextProvider } from './text-provider.js';

type Named = { readonly name: string };

/**
 * Prueba los proveedores en orden y devuelve la primera respuesta. Ante cualquier error
 * pasa al siguiente; si el error es pasajero (caído, saturado, sin cupo, timeout), además
 * aparta ese proveedor unos minutos para no volver a esperarlo. Registra quién respondió
 * y cuánto tardó: es la base del futuro panel comparativo de proveedores.
 */
export async function runChain<P extends Named, T>(
  providers: P[],
  task: string,
  call: (provider: P) => Promise<T>,
  logger: Logger,
): Promise<T> {
  const byName = new Map(providers.map((p) => [`proveedor:${p.name}`, p]));
  const skipped: string[] = [];
  const started = Date.now();
  let lastError: unknown;
  for (const key of modelOrder([...byName.keys()])) {
    const provider = byName.get(key)!;
    const t = Date.now();
    try {
      const result = await call(provider);
      recover(key);
      const via = skipped.length ? ` · saltados: ${skipped.join(', ')}` : '';
      logger.log(`${task} → ${provider.name} en ${Date.now() - t} ms (total ${Date.now() - started} ms${via})`);
      return result;
    } catch (error) {
      lastError = error;
      const message = (error as Error).message?.slice(0, 100) ?? String(error);
      skipped.push(`${provider.name} (${Date.now() - t} ms: ${message})`);
      if (isTransient(error)) coolDown(key);
    }
  }
  logger.warn(`${task}: fallaron todos (${skipped.join('; ')})`);
  throw lastError;
}

export class DecisionChain implements DecisionProvider {
  readonly name: string;
  private readonly logger = new Logger('Decisiones');

  constructor(private readonly providers: DecisionProvider[]) {
    if (!providers.length) throw new Error('La cadena de decisiones está vacía');
    this.name = providers.map((p) => p.name).join(' → ');
  }

  decide<Q extends Record<string, DecisionQuestion>>(state: string | Record<string, unknown>, questions: Q) {
    const types = [...new Set(Object.values(questions).map((q) => q.type))].join('+');
    return runChain(this.providers, `decisión ${types}`, (p) => p.decide(state, questions), this.logger);
  }
}

export class TextChain implements TextProvider {
  readonly name: string;
  private readonly logger = new Logger('Texto');

  constructor(private readonly providers: TextProvider[]) {
    if (!providers.length) throw new Error('La cadena de texto está vacía');
    this.name = providers.map((p) => p.name).join(' → ');
  }

  write<S extends z.ZodType>(request: { system: string; prompt: string; schema: S }): Promise<z.infer<S>> {
    return runChain(this.providers, 'texto', (p) => p.write(request), this.logger);
  }
}
