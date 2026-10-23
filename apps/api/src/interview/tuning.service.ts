import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { DECISION_PROVIDER, type DecisionProvider, type DecisionQuestion } from '../ai/decision-provider.js';
import { TEXT_PROVIDER, type TextProvider } from '../ai/text-provider.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions, items, type ItemRow, type SessionRow } from '../db/schema.js';
import { DomainsService, type DomainRow } from '../domains/domains.service.js';
import { answerChips, answered, applyRefinements, informedDimensions, rankCandidates } from './interview.engine.js';
import { stateExtras } from './interview.context.js';
import { InterviewService } from './interview.service.js';
import type { MoodProfile, SessionResult } from './interview.types.js';

export type TuningEvent =
  | { step: 'profile'; profile: MoodProfile }
  | { step: 'candidates'; count: number; total: number }
  | { step: 'fit'; checked: number; total: number }
  | { step: 'explain' }
  | { step: 'done'; sessionId: string }
  | { step: 'error'; message: string };

const SCORE_LEVELS: [string, string, string, string, string] = ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Muy alto'];
const FIT_BATCH = 8;

const explanationSchema = z.object({
  title: z.string().describe('Título corto y evocador para la lista, de 2 a 4 palabras'),
  reasons: z.array(
    z.object({
      n: z.number().int().describe('Número del elemento en la lista'),
      reason: z.string().describe('Una o dos frases, máximo 25 palabras'),
    }),
  ),
});

@Injectable()
export class TuningService {
  private readonly logger = new Logger('Afinando');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(DECISION_PROVIDER) private readonly decisions: DecisionProvider,
    @Inject(TEXT_PROVIDER) private readonly text: TextProvider,
    private readonly domains: DomainsService,
    private readonly interviews: InterviewService,
  ) {}

  /**
   * Perfil (score) → candidatos por atributos → ¿encaja? (noul) → explicaciones.
   * Emite un evento por paso para que la pantalla Afinando muestre el progreso real.
   */
  async *run(sessionId: string, refinements: string[]): AsyncGenerator<TuningEvent> {
    const session = await this.interviews.load(sessionId);
    if (session.status === 'asking') throw new BadRequestException('La entrevista aún no ha terminado');
    const domain = await this.domains.get(session.domainId);
    const { config } = domain;

    const base = session.profile ?? (await this.computeProfile(session, domain));
    const profile = applyRefinements(base, refinements, config);
    yield { step: 'profile', profile };

    const catalog = await this.db.select().from(items).where(eq(items.domainId, domain.id));
    const candidates = rankCandidates(catalog, profile, config, config.result.candidates);
    yield {
      step: 'candidates',
      count: candidates.length,
      total: catalog.length,
    };

    const judged = candidates.slice(0, config.result.judged);
    const fit = new Map<string, number>();
    for (let i = 0; i < judged.length; i += FIT_BATCH) {
      const batch = judged.slice(i, i + FIT_BATCH);
      const answers = await this.decisions.decide(
        {
          busca: profile.summary,
          perfil: this.describeProfile(profile, domain),
          ...stateExtras(session),
        },
        Object.fromEntries(
          batch.map(({ item }) => [
            item.id,
            {
              type: 'noul',
              instructions: `¿Encaja con lo que busca esta ${domain.itemNoun}? ${this.describeItem(item, domain)}`,
            },
          ]),
        ) as Record<string, DecisionQuestion & { type: 'noul' }>,
      );
      for (const [id, a] of Object.entries(answers)) fit.set(id, a.probability);
      yield {
        step: 'fit',
        checked: Math.min(i + FIT_BATCH, judged.length),
        total: judged.length,
      };
    }

    const finalists = judged
      .map(({ item, score }) => ({
        item,
        fit: fit.get(item.id) ?? null,
        match: Math.round(100 * (0.55 * score + 0.45 * (fit.get(item.id) ?? 0.5))),
      }))
      .sort((a, b) => b.match - a.match)
      .slice(0, config.result.size);

    yield { step: 'explain' };
    // Si Gemini está saturado, la lista se guarda igual (sin explicaciones) en vez de perderla.
    const written = await this.text
      .write({
        system: `${config.voice} Explicas por qué cada ${domain.itemNoun} encaja con el ánimo de la persona, sin repetir fórmulas.`,
        prompt: [
          `Lo que busca: ${profile.summary.join(', ') || 'sin preferencias claras'}.`,
          `Perfil: ${this.describeProfile(profile, domain)}`,
          `${domain.itemNounPlural} elegidas:`,
          ...finalists.map(({ item }, i) => `${i + 1}. ${this.describeItem(item, domain)}`),
          `Devuelve un título para la lista y exactamente ${finalists.length} explicaciones, una por número, en tono cercano. Puedes citar datos (estilo, energía, voz).`,
        ].join('\n'),
        schema: explanationSchema,
      })
      .catch((error: Error): z.infer<typeof explanationSchema> => {
        this.logger.warn(`Sin explicaciones: ${error.message}`);
        return { title: 'Tu lista', reasons: [] };
      });
    const reasons = new Map(written.reasons.map((r) => [r.n - 1, r.reason]));

    const result: SessionResult = {
      title: written.title,
      entries: finalists.map(({ item, match, fit: p }, i) => ({
        itemId: item.id,
        match,
        fit: p === null ? null : round(p),
        reason: reasons.get(i) ?? '',
      })),
      candidates: candidates.length,
      catalogSize: catalog.length,
      refinements,
      createdAt: new Date().toISOString(),
    };
    await this.db
      .update(interviewSessions)
      .set({ profile: base, result, status: 'done', updatedAt: new Date() })
      .where(eq(interviewSessions.id, session.id));
    this.logger.log(`Lista "${result.title}" lista con ${result.entries.length} elementos`);
    yield { step: 'done', sessionId: session.id };
  }

  async result(sessionId: string) {
    const session = await this.interviews.load(sessionId);
    if (!session.result || !session.profile) throw new BadRequestException('Esta entrevista todavía no tiene lista');
    const domain = await this.domains.get(session.domainId);
    const ids = session.result.entries.map((e) => e.itemId);
    const rows = ids.length ? await this.db.select().from(items).where(inArray(items.id, ids)) : [];
    const byId = new Map(rows.map((r) => [r.id, r]));

    return {
      id: session.id,
      domainId: session.domainId,
      title: session.result.title,
      answeredCount: answered(session.turns).length,
      chips: answerChips(session.turns, domain.config),
      profile: applyRefinements(session.profile, session.result.refinements, domain.config),
      attributes: domain.config.attributes.filter((a) => a.kind === 'scale'),
      refinements: domain.config.refinements.map(({ key, label }) => ({
        key,
        label,
      })),
      appliedRefinements: session.result.refinements,
      candidates: session.result.candidates,
      catalogSize: session.result.catalogSize,
      entries: session.result.entries.flatMap((e) => {
        const item = byId.get(e.itemId);
        return item
          ? [
              {
                match: e.match,
                fit: e.fit ?? null,
                reason: e.reason,
                item: this.publicItem(item),
              },
            ]
          : [];
      }),
    };
  }

  /** Jev `score` por atributo y `noul` por grupo de etiquetas, en una sola llamada. */
  private async computeProfile(session: SessionRow, domain: DomainRow): Promise<MoodProfile> {
    const { config } = domain;
    const scales = config.attributes.filter((a) => a.kind === 'scale');
    const answers = answered(session.turns).map((t) => ({
      pregunta: t.text,
      respuesta: t.answer === 'yes' ? 'sí' : t.answer === 'no' ? 'no' : 'no lo sé',
    }));

    const questions: Record<string, DecisionQuestion> = {};
    for (const a of scales) {
      questions[`scale_${a.key}`] = {
        type: 'score',
        instructions: `¿Cuánto de "${a.label}" (${a.description}; de ${a.lowLabel} a ${a.highLabel}) quiere escuchar ahora? Si no hay pistas, elige Medio.`,
        criteria: SCORE_LEVELS,
      };
    }
    for (const g of config.tagGroups) {
      questions[`tags_${g.key}`] = {
        type: 'noul',
        instructions: `¿Le apetecería escuchar ${g.label}?`,
      };
    }

    const informed = informedDimensions(session.turns, config);
    const result = await this.decisions.decide({ respuestas: answers, ...stateExtras(session) }, questions);
    const profile: MoodProfile = {
      scales: Object.fromEntries(
        scales.map((a) => [a.key, round((result[`scale_${a.key}`] as { score: number }).score)]),
      ),
      tagGroups: Object.fromEntries(
        config.tagGroups.map((g) => [g.key, round((result[`tags_${g.key}`] as { probability: number }).probability)]),
      ),
      informed: [...informed],
      // Con respuesta directa la dimensión es fiable; sin ella, el valor es una suposición.
      // Cuando se use el texto inicial, aquí entrará la confianza que devuelva `score`.
      confidence: Object.fromEntries(
        [...scales.map((a) => a.key), ...(config.tagGroups.length ? ['genres'] : [])].map((k) => [
          k,
          informed.has(k) ? 0.9 : 0.3,
        ]),
      ),
      summary: answerChips(session.turns, config),
    };
    await this.db.update(interviewSessions).set({ profile }).where(eq(interviewSessions.id, session.id));
    return profile;
  }

  private describeProfile(profile: MoodProfile, domain: DomainRow) {
    return domain.config.attributes
      .filter((a) => a.kind === 'scale')
      .map((a) => `${a.label} ${profile.scales[a.key]?.toFixed(2)}`)
      .join(', ');
  }

  private describeItem(item: ItemRow, domain: DomainRow) {
    const attrs = domain.config.attributes
      .filter((a) => a.kind === 'scale' && item.attributes[a.key] !== undefined)
      .map((a) => `${a.label.toLowerCase()} ${item.attributes[a.key].toFixed(2)}`)
      .join(', ');
    return `«${item.title}» de ${item.subtitle ?? 'autor desconocido'}. Etiquetas: ${item.tags.slice(0, 6).join(', ') || '—'}. ${attrs}.`;
  }

  publicItem(item: ItemRow) {
    const { embedding: _embedding, createdAt: _createdAt, ...rest } = item;
    return rest;
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
