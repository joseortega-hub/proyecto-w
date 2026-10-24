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
    const open = (domain.config.preferences ?? []).filter((p) => !this.valid(domain, p.key, chosen[p.key]));
    const guessed = open.length && initialText?.trim() ? await this.guess(domain, initialText, open.map((p) => p.key)) : {};
    return this.merge(
      domain,
      chosen,
      Object.fromEntries(Object.entries(guessed).map(([k, g]) => [k, { value: g.value, confidence: g.confidence ?? 0.7 }])),
    );
  }

  /** Lo elegido con los botones gana a lo deducido; sin ninguna de las dos, "me da igual". */
  merge(domain: DomainRow, chosen: Record<string, string> = {}, guessed: Record<string, { value: string; confidence: number }> = {}): SessionPreferences {
    const out: SessionPreferences = {};
    for (const pref of domain.config.preferences ?? []) {
      if (this.valid(domain, pref.key, chosen[pref.key])) out[pref.key] = { value: chosen[pref.key], source: 'user', confidence: null };
      else if (this.valid(domain, pref.key, guessed[pref.key]?.value)) {
        out[pref.key] = { value: guessed[pref.key].value, source: 'guess', confidence: guessed[pref.key].confidence };
      } else out[pref.key] = { value: pref.anyValue, source: 'user', confidence: null };
    }
    return out;
  }

  private valid(domain: DomainRow, key: string, value: string | undefined): value is string {
    return !!value && !!(domain.config.preferences ?? []).find((p) => p.key === key)?.options.some((o) => o.value === value);
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
