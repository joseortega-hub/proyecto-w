import { Logger } from '@nestjs/common';
import type { z } from 'zod';
import type { DecisionAnswer, DecisionProvider, DecisionQuestion } from './decision-provider.js';
import { coolDown, isTransient, modelOrder, recover } from './model-fallback.js';
import { rememberChoice } from './last-choice.js';
import type { TextProvider } from './text-provider.js';
import { currentSession, emitTrace, skipReason, withAttempt, type SkippedProvider } from './trace-context.js';

type Named = { readonly name: string };

/** "groq:openai/gpt-oss-120b" → "groq"; Laya llega como "ollaya:laya:…" y se muestra como "laya". */
const labelOf = (name: string) => {
  const label = name.split(':')[0];
  return label === 'ollaya' ? 'laya' : label;
};

/** Qué se anota de la llamada en la traza (solo metadatos, nunca el texto de la persona). */
export interface ChainMeta<T> {
  task: string;
  subject: string;
  outcome?: (result: T) => string | undefined;
}

/**
 * Prueba los proveedores en orden y devuelve la primera respuesta. Ante cualquier error
 * pasa al siguiente; si el error es pasajero (caído, saturado, sin cupo, timeout), además
 * aparta ese proveedor unos minutos para no volver a esperarlo. Registra quién respondió
 * y cuánto tardó, y emite la traza que alimenta el panel "Bajo el capó".
 */
export async function runChain<P extends Named, T>(
  providers: P[],
  task: string,
  call: (provider: P) => Promise<T>,
  logger: Logger,
  meta: ChainMeta<T> = { task, subject: task },
): Promise<T> {
  const byName = new Map(providers.map((p) => [`proveedor:${p.name}`, p]));
  const skipped: string[] = [];
  const skippedTrace: SkippedProvider[] = [];
  const started = Date.now();
  const sessionId = currentSession() ?? null;
  let lastError: unknown;
  for (const key of modelOrder([...byName.keys()])) {
    const provider = byName.get(key)!;
    const t = Date.now();
    try {
      const { result, usage } = await withAttempt(() => call(provider));
      recover(key);
      const via = skipped.length ? ` · saltados: ${skipped.join(', ')}` : '';
      logger.log(`${task} → ${provider.name} en ${Date.now() - t} ms (total ${Date.now() - started} ms${via})`);
      const [, ...rest] = provider.name.split(':');
      const label = labelOf(provider.name);
      emitTrace({
        sessionId,
        task: meta.task,
        subject: meta.subject,
        provider: label,
        model: usage.model ?? (rest.join(':') || null),
        ok: true,
        skipped: skippedTrace,
        latencyMs: Date.now() - t,
        totalMs: Date.now() - started,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        outcome: meta.outcome?.(result) ?? null,
      });
      return result;
    } catch (error) {
      lastError = error;
      const message = (error as Error).message?.slice(0, 100) ?? String(error);
      skipped.push(`${provider.name} (${Date.now() - t} ms: ${message})`);
      skippedTrace.push({ provider: labelOf(provider.name), reason: skipReason(error), ms: Date.now() - t });
      if (isTransient(error)) coolDown(key);
    }
  }
  logger.warn(`${task}: fallaron todos (${skipped.join('; ')})`);
  emitTrace({
    sessionId,
    task: meta.task,
    subject: meta.subject,
    provider: null,
    model: null,
    ok: false,
    skipped: skippedTrace,
    latencyMs: 0,
    totalMs: Date.now() - started,
    inputTokens: null,
    outputTokens: null,
    outcome: null,
  });
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
    const subject = Object.keys(questions).join('+');
    const sessionId = currentSession();
    return runChain(this.providers, `decisión ${types}`, (p) => p.decide(state, questions), this.logger, {
      task: types,
      subject,
      outcome: (answers) => {
        const first = Object.values(answers)[0] as DecisionAnswer | undefined;
        return first?.type === 'choice' ? first.choice : undefined;
      },
    }).then((answers) => {
      if (sessionId && types.includes('choice')) {
        const chosen = Object.fromEntries(
          Object.entries(answers as Record<string, DecisionAnswer>).flatMap(([id, a]) =>
            a.type === 'choice' ? [[id, { choice: a.choice, confidence: a.confidence }]] : [],
          ),
        );
        rememberChoice(sessionId, { state, questions, chosen });
      }
      return answers;
    });
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
    return runChain(this.providers, 'texto', (p) => p.write(request), this.logger, { task: 'text', subject: 'texto' });
  }
}
