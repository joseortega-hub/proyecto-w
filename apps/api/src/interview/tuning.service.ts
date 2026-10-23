import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { DECISION_PROVIDER, type DecisionProvider, type DecisionQuestion } from '../ai/decision-provider.js';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../ai/embedding-provider.js';
import { TEXT_PROVIDER, type TextProvider } from '../ai/text-provider.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions, items, type SessionRow } from '../db/schema.js';
import { DomainsService, type DomainRow } from '../domains/domains.service.js';
import { ItemsService, publicItem, type ItemWithoutEmbedding } from '../items/items.service.js';
import { hasTaste, tasteHints, type TasteProfile } from '../taste/taste.engine.js';
import { TasteService } from '../taste/taste.service.js';
import {
  answerChips,
  answered,
  applyRefinements,
  characterWords,
  fallbackReason,
  hasRawFigures,
  hybridRank,
  informedDimensions,
  matchHints,
  matchPercent,
  percentiles,
  preferenceFilters,
  preferenceNotice,
  profileQueryText,
  rankCandidates,
  signalChips,
  type FacetFilter,
  type HybridCandidate,
} from './interview.engine.js';
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
/** Vecinos semánticos que se traen de pgvector antes del ranking híbrido. */
const SEMANTIC_POOL = 120;

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
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    private readonly items: ItemsService,
    private readonly domains: DomainsService,
    private readonly interviews: InterviewService,
    private readonly tastes: TasteService,
  ) {}

  /**
   * Perfil (score) → candidatos (pgvector + atributos) → ¿encaja? (noul) → explicaciones.
   * Emite un evento por paso para que la pantalla Afinando muestre el progreso real.
   */
  async *run(sessionId: string, refinements: string[]): AsyncGenerator<TuningEvent> {
    const session = await this.interviews.load(sessionId);
    if (session.status === 'asking') throw new BadRequestException('La entrevista aún no ha terminado');
    const domain = await this.domains.get(session.domainId);
    const { config } = domain;
    // Gustos al día (incluye los últimos 👍/👎); sin persona, la copia del inicio de la entrevista.
    const fresh = await this.tastes.profile(session.userId, domain.id).catch(() => null);
    const taste = hasTaste(fresh) ? fresh : session.taste;
    session.taste = taste;

    const base = session.profile ?? (await this.computeProfile(session, domain));
    const profile = applyRefinements(base, refinements, config);
    yield { step: 'profile', profile };

    // Las preferencias previas (p. ej. idioma) filtran el catálogo antes de buscar, no después.
    const filters = preferenceFilters(session.preferences, config);
    const catalog = await this.items.catalog(domain.id, filters);
    const candidates = await this.findCandidates(session, domain, profile, catalog, filters, taste);
    yield {
      step: 'candidates',
      count: candidates.length,
      total: catalog.length,
    };

    const judged = candidates.slice(0, config.result.judged);
    const fit = new Map<string, number>();
    for (let i = 0; i < judged.length; i += FIT_BATCH) {
      const batch = judged.slice(i, i + FIT_BATCH);
      // Si el proveedor falla, ese lote se queda sin `fit` y el % sale solo de la relevancia.
      const answers = await this.decisions
        .decide(
          {
            busca: profile.summary,
            perfil: this.describeProfile(profile, domain),
            ...stateExtras(session, config),
          },
          Object.fromEntries(
            batch.map(({ item }) => [
              item.id,
              {
                type: 'noul',
                instructions: `¿Encaja con lo que busca ${config.gender === 'f' ? 'esta' : 'este'} ${domain.itemNoun}? ${this.describeItem(item, domain)}`,
              },
            ]),
          ) as Record<string, DecisionQuestion & { type: 'noul' }>,
        )
        .catch((error: Error) => {
          this.logger.warn(`Encaje sin comprobar para ${batch.length} elementos: ${error.message.slice(0, 120)}`);
          return {};
        });
      for (const [id, a] of Object.entries(answers)) fit.set(id, a.probability);
      yield {
        step: 'fit',
        checked: Math.min(i + FIT_BATCH, judged.length),
        total: judged.length,
      };
    }

    // La relevancia se reparte dentro de los evaluados para que el % no se amontone arriba.
    const relevance = percentiles(judged.map((c) => c.relevance));
    const finalists = judged
      .map(({ item }, i) => ({
        item,
        fit: fit.get(item.id) ?? null,
        match: matchPercent(relevance[i], fit.get(item.id) ?? null),
      }))
      .sort((a, b) => b.match - a.match)
      .slice(0, config.result.size);

    yield { step: 'explain' };
    const { title, reasons } = await this.explain(
      profile,
      domain,
      finalists.map((f) => f.item),
      taste,
    );

    const notice = preferenceNotice(
      finalists.map((f) => f.item),
      session.preferences,
      config,
      domain.itemNounPlural,
      config.result.size,
    );
    const result: SessionResult = {
      title,
      notice,
      entries: finalists.map(({ item, match, fit: p }, i) => ({
        itemId: item.id,
        match,
        fit: p === null ? null : round(p),
        reason: reasons[i],
      })),
      candidates: candidates.length,
      catalogSize: catalog.length,
      refinements,
      createdAt: new Date().toISOString(),
    };
    await this.db
      .update(interviewSessions)
      .set({ profile: base, result, status: 'done', initialText: null, taste, updatedAt: new Date() })
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
      chips: [...signalChips(session.textSignals ?? {}, domain.config), ...answerChips(session.turns, domain.config)],
      profile: applyRefinements(session.profile, session.result.refinements, domain.config),
      attributes: domain.config.attributes.filter((a) => a.kind === 'scale'),
      refinements: domain.config.refinements.map(({ key, label }) => ({
        key,
        label,
      })),
      appliedRefinements: session.result.refinements,
      preferences: session.preferences,
      notice: session.result.notice ?? null,
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
                /** Gustos de la persona con los que encaja ("rol y aventura"). */
                likes: tasteHints(item, session.taste, domain.config),
                item: publicItem(item),
              },
            ]
          : [];
      }),
    };
  }

  /**
   * Bolsa de candidatos = vecinos semánticos (pgvector) ∪ mejores por atributos, y
   * ranking híbrido sobre ella. Si no hay embeddings o falla la consulta, solo atributos.
   */
  private async findCandidates(
    session: SessionRow,
    domain: DomainRow,
    profile: MoodProfile,
    catalog: ItemWithoutEmbedding[],
    filters: FacetFilter[],
    taste: TasteProfile | null,
  ): Promise<HybridCandidate<ItemWithoutEmbedding>[]> {
    const { config } = domain;
    const byAttributes = rankCandidates(catalog, profile, config, SEMANTIC_POOL / 2, 2, taste);
    const query = profileQueryText(profile, config, domain.itemNounPlural, session.initialText);
    const vector = await this.embeddings
      .embed([query], 'query')
      .then(([v]) => v)
      .catch((error: Error) => {
        this.logger.warn(`Sin búsqueda semántica: ${error.message}`);
        return null;
      });
    if (!vector) {
      return hybridRank(
        byAttributes.map(({ item }) => ({ item, semantic: null })),
        profile,
        config,
        config.result.candidates,
        { taste },
      );
    }

    const nearest = await this.items.nearest(domain.id, vector, SEMANTIC_POOL, { filters });
    const pool = new Map<string, { item: ItemWithoutEmbedding; semantic: number | null }>(
      nearest.map(({ semantic, ...item }) => [item.id, { item, semantic: Number(semantic) }]),
    );
    const missing = byAttributes.filter(({ item }) => !pool.has(item.id)).map(({ item }) => item);
    const sims = await this.items.similarities(
      domain.id,
      missing.map((i) => i.id),
      vector,
    );
    for (const item of missing) pool.set(item.id, { item, semantic: sims.get(item.id) ?? null });
    this.logger.log(`Consulta semántica: "${query}" → ${nearest.length} vecinos + ${missing.length} por atributos`);
    return hybridRank([...pool.values()], profile, config, config.result.candidates, { taste });
  }

  /**
   * Título y una explicación por elemento. Si el modelo se salta alguna, se pide otra
   * vez solo por las que faltan; si aún faltan, se usa una explicación de respaldo.
   */
  private async explain(profile: MoodProfile, domain: DomainRow, list: ItemWithoutEmbedding[], taste: TasteProfile | null) {
    const { config } = domain;
    const reasons: (string | null)[] = list.map(() => null);
    let title = 'Tu lista';

    for (let attempt = 0; attempt < 2; attempt++) {
      const missing = reasons.flatMap((r, i) => (r ? [] : [i]));
      if (!missing.length) break;
      const written = await this.text
        .write({
          system: `${config.voice} Explicas por qué cada ${domain.itemNoun} encaja con el ánimo de la persona, sin repetir fórmulas.`,
          prompt: [
            `Lo que busca: ${profile.summary.join(', ') || 'sin preferencias claras'}.`,
            `Carácter que le apetece: ${characterWords(profile.scales, config).join(', ') || 'sin preferencias marcadas'}.`,
            `${capitalize(domain.itemNounPlural)} ${config.gender === 'f' ? 'elegidas' : 'elegidos'}:`,
            ...missing.map((i) => {
              const hints = matchHints(list[i], profile, config);
              const likes = tasteHints(list[i], taste, config);
              return `${i + 1}. ${this.describeItem(list[i], domain, { words: true })}${hints.length ? ` Coincide en: ${hints.join(', ')}.` : ''}${likes.length ? ` Encaja con sus gustos de siempre: ${likes.join(', ')}.` : ''}`;
            }),
            `Devuelve ${attempt === 0 ? 'un título para la lista y ' : ''}exactamente ${missing.length} explicaciones, una por cada número de arriba (usa ese mismo número), en tono cercano y en español (en inglés, solo nombres propios y géneros). Apóyate en las coincidencias y en datos concretos (${config.attributes.slice(0, 3).map((a) => a.label.toLowerCase()).join(', ')}), siempre con palabras, sin cifras ni porcentajes.`,
          ].join('\n'),
          schema: explanationSchema,
        })
        .catch((error: Error) => {
          // Si Gemini está saturado, la lista se guarda igual en vez de perderla.
          this.logger.warn(`Explicaciones (intento ${attempt + 1}): ${error.message}`);
          return null;
        });
      if (!written) continue;
      if (attempt === 0 && written.title.trim()) title = written.title.trim();
      for (const r of written.reasons) {
        const i = r.n - 1;
        // Una explicación con cifras internas ("tono casi 1.0") se vuelve a pedir.
        if (missing.includes(i) && r.reason.trim() && !hasRawFigures(r.reason)) reasons[i] = r.reason.trim();
      }
    }

    const fallbacks = reasons.filter((r) => !r).length;
    if (fallbacks) this.logger.warn(`${fallbacks} explicaciones de respaldo`);
    return {
      title,
      reasons: reasons.map((r, i) => r ?? fallbackReason(list[i], profile, config)),
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
        instructions: `¿Cuánto de "${a.label}" (${a.description}; de ${a.lowLabel} a ${a.highLabel}) quiere para ${config.verb} ahora? Si no hay pistas, elige Medio.`,
        criteria: SCORE_LEVELS,
      };
    }
    for (const g of config.tagGroups) {
      questions[`tags_${g.key}`] = {
        type: 'noul',
        instructions: `¿Le apetecería algo de ${g.label} para ${config.verb}?`,
      };
    }

    const known = Object.keys(session.textSignals ?? {});
    const informed = informedDimensions(session.turns, config, known);
    const result = await this.decisions.decide({ respuestas: answers, ...stateExtras(session, config) }, questions);
    const profile: MoodProfile = {
      scales: Object.fromEntries(
        scales.map((a) => [a.key, round((result[`scale_${a.key}`] as { score: number }).score)]),
      ),
      tagGroups: Object.fromEntries(
        config.tagGroups.map((g) => [g.key, round((result[`tags_${g.key}`] as { probability: number }).probability)]),
      ),
      informed: [...informed],
      // Con respuesta directa la dimensión es fiable; si salió del texto inicial, vale su
      // confianza; sin nada, el valor es una suposición.
      confidence: Object.fromEntries(
        [...scales.map((a) => a.key), ...(config.tagGroups.length ? ['genres'] : [])].map((k) => [
          k,
          session.textSignals?.[k]?.confidence ?? (informed.has(k) ? 0.9 : 0.3),
        ]),
      ),
      summary: [...signalChips(session.textSignals ?? {}, config), ...answerChips(session.turns, config)],
    };
    // Privacidad: con el perfil ya calculado, el texto inicial deja de hacer falta y se borra.
    await this.db
      .update(interviewSessions)
      .set({ profile, initialText: null })
      .where(eq(interviewSessions.id, session.id));
    return profile;
  }

  private describeProfile(profile: MoodProfile, domain: DomainRow) {
    return domain.config.attributes
      .filter((a) => a.kind === 'scale')
      .map((a) => `${a.label} ${profile.scales[a.key]?.toFixed(2)}`)
      .join(', ');
  }

  /**
   * Elemento para un prompt. Las decisiones (`noul`) reciben los atributos con cifras; los
   * textos para personas (`words`), con palabras, para que no acaben en las explicaciones.
   */
  private describeItem(item: ItemWithoutEmbedding, domain: DomainRow, { words = false } = {}) {
    const attrs = words
      ? characterWords(item.attributes, domain.config).join(', ')
      : domain.config.attributes
          .filter((a) => a.kind === 'scale' && item.attributes[a.key] !== undefined)
          .map((a) => `${a.label.toLowerCase()} ${item.attributes[a.key].toFixed(2)}`)
          .join(', ');
    const { creatorLabel, playable } = domain.config;
    // En música la descripción es el álbum; en el resto, la sinopsis ayuda a juzgar el encaje.
    const about = !playable && item.description ? ` Sinopsis: ${item.description.slice(0, 160)}.` : '';
    return `«${item.title}» (${creatorLabel}: ${item.subtitle ?? 'desconocido'}). Etiquetas: ${item.tags.slice(0, 6).join(', ') || '—'}.${attrs ? ` ${words ? 'Carácter: ' : ''}${attrs}.` : ''}${about}`;
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
