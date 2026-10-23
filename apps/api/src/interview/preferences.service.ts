import { Inject, Injectable, Logger } from '@nestjs/common';
import { DECISION_PROVIDER, type DecisionProvider, type DecisionQuestion } from '../ai/decision-provider.js';
import type { DomainRow } from '../domains/domains.service.js';
import type { SessionPreferences } from './interview.types.js';

/**
 * Preferencias previas de una entrevista (p. ej. el idioma de la letra). Lo que elige
 * la persona manda; si no eligió y hay texto inicial, `choice` propone una opción con
 * su confianza. El texto va siempre en el `state`, nunca en las instrucciones.
 */
@Injectable()
export class PreferencesService {
  private readonly logger = new Logger('Preferencias');

  constructor(@Inject(DECISION_PROVIDER) private readonly decisions: DecisionProvider) {}

  async resolve(domain: DomainRow, chosen: Record<string, string> = {}, initialText?: string | null) {
    const prefs = domain.config.preferences ?? [];
    const out: SessionPreferences = {};
    for (const pref of prefs) {
      const value = chosen[pref.key];
      if (value && pref.options.some((o) => o.value === value)) {
        out[pref.key] = { value, source: 'user', confidence: null };
      }
    }
    const open = prefs.filter((p) => !out[p.key]);
    if (open.length && initialText?.trim()) Object.assign(out, await this.guess(domain, initialText, open.map((p) => p.key)));
    for (const pref of prefs) out[pref.key] ??= { value: pref.anyValue, source: 'user', confidence: null };
    return out;
  }

  /** Deduce las preferencias a partir del texto inicial. Si falla, no deduce nada. */
  async guess(domain: DomainRow, text: string, keys?: string[]): Promise<SessionPreferences> {
    const prefs = (domain.config.preferences ?? []).filter((p) => !keys || keys.includes(p.key));
    if (!prefs.length || !text.trim()) return {};
    const answers = await this.decisions
      .decide(
        { textoDeLaPersona: text.slice(0, 500) },
        Object.fromEntries(
          prefs.map((p) => [
            p.key,
            {
              type: 'choice',
              instructions: p.guessInstructions,
              criteria: Object.fromEntries(p.options.map((o) => [o.value, o.label])),
            },
          ]),
        ) as Record<string, DecisionQuestion & { type: 'choice' }>,
      )
      .catch((error: Error) => {
        this.logger.warn(`Sin preselección: ${error.message.slice(0, 120)}`);
        return null;
      });
    if (!answers) return {};
    return Object.fromEntries(
      prefs.flatMap((p) => {
        const a = answers[p.key];
        return a && p.options.some((o) => o.value === a.choice)
          ? [[p.key, { value: a.choice, source: 'guess' as const, confidence: a.confidence }]]
          : [];
      }),
    );
  }
}
