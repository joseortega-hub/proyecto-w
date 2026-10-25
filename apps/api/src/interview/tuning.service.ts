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
import { hasTaste, tasteHints, withoutOff, type TasteProfile } from '../taste/taste.engine.js';
import { TasteService } from '../taste/taste.service.js';
import {
  answerChips,
  answered,
  answersProfile,
  applyRefinements,
  characterWords,
  hybridRank,
  informedDimensions,
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
import { titleKey } from './catalog-match.js';
import { ANCHOR_BOOST, ANCHOR_MATCH, anchorMatches, anchorMode, anchorNotice, anchorQueryText, bestAnchor, excludedByAnchors, seedIds, shortReason } from './anchors.js';
import { AnchorsService } from './anchors.service.js';
import { currentWeights } from './candidates.js';
import { InterviewService } from './interview.service.js';
import type { Anchor, MoodProfile, SessionResult } from './interview.types.js';
import { applyVibe, reorderByVibe, vibeSources } from './vibe.engine.js';

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
/** Cuánto empuja a la relevancia (0–1) el peso que dejó la entrevista a cada candidata de la bolsa. */
const BAG_BOOST = 0.8;

const titleSchema = z.object({
  title: z.string().describe('Título corto y evocador para la lista, de 2 a 4 palabras'),
});

/** Cómo usa la búsqueda lo que pidió la persona (ver `anchorMode`). */
interface AnchorPlan {
  anchors: Anchor[];
  mode: 'filter' | 'boost' | 'none';
  matched: Set<string>;
}

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
    private readonly anchors: AnchorsService,
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
    const fresh = withoutOff(await this.tastes.profile(session.userId, domain.id).catch(() => null), session.tasteOff);
    const taste = hasTaste(fresh) ? fresh : session.taste;
    session.taste = taste;

    const base = session.profile ?? (await this.computeProfile(session, domain));
    const profile = applyRefinements(base, refinements, config);
    yield { step: 'profile', profile };

    // Las preferencias previas (p. ej. idioma) filtran el catálogo antes de buscar, no después.
    const filters = preferenceFilters(session.preferences, config);
    const anchors = session.anchors ?? [];
    // Lo que se buscó en directo al empezar tiene que estar guardado antes de leer el catálogo.
    if (anchors.length) await this.anchors.awaitCoverage(domain, anchors, session.userId);
    const excludedTags = new Set(config.tagGroups.filter((g) => session.exclusions?.includes(g.key)).flatMap((g) => g.tags));
    // Lo que no quiere ("nada de terror") no sale nunca, tenga o no bolsa la entrevista.
    const filtered = (await this.items.catalog(domain.id, filters, session.userId)).filter((it) => !it.tags.some((t) => excludedTags.has(t)) && !excludedByAnchors(it, anchors));
    // Los títulos pedidos (semillas) van siempre, aunque un filtro los deje fuera.
    const seeds = seedIds(anchors);
    const missingSeeds = seeds.filter((id) => !filtered.some((it) => it.id === id));
    const catalog = missingSeeds.length ? [...filtered, ...(await this.items.byIds(domain.id, missingSeeds, session.userId))] : filtered;
    const matched = anchorMatches(catalog, anchors);
    const plan: AnchorPlan = { anchors, mode: anchorMode(anchors, matched.length, config.result.size), matched: new Set(matched.map((m) => m.id)) };
    if (anchors.length) this.logger.log(`Anclas ${anchors.map((a) => a.label).join(', ')}: ${matched.length} en el catálogo → ${plan.mode}`);
    const candidates = await this.findCandidates(session, domain, profile, catalog, filters, taste, plan);
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
    // Cuando no se filtra, lo que pidió va primero aunque otro encaje algo mejor con el ánimo.
    const anchored = (id: string) => (plan.mode === 'boost' && plan.matched.has(id) ? 1 : 0);
    const finalists = judged
      .map(({ item }, i) => ({
        item,
        fit: fit.get(item.id) ?? null,
        match: matchPercent(relevance[i], fit.get(item.id) ?? null),
      }))
      .sort((a, b) => anchored(b.item.id) - anchored(a.item.id) || b.match - a.match);
    // Los títulos pedidos primero, siempre; si no llegaron a evaluarse, entran igual.
    const byId = new Map(catalog.map((it) => [it.id, it]));
    const seeded = seeds.flatMap((id) => {
      const found = finalists.find((f) => f.item.id === id);
      const item = byId.get(id);
      return found ? [found] : item ? [{ item, fit: null, match: 100 }] : [];
    });
    // Sin ediciones repetidas del mismo título (la semilla y su otra edición, p. ej.).
    const seen = new Set<string>();
    const unique = [...seeded, ...finalists.filter((f) => !seeds.includes(f.item.id))].filter((f) => {
      const key = titleKey(f.item.title);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    finalists.splice(0, finalists.length, ...unique.slice(0, config.result.size));

    yield { step: 'explain' };
    const list = finalists.map((f) => f.item);
    const title = await this.title(profile, domain, list, anchors);
    const reasons = list.map((item) =>
      shortReason(item, { config, profile, anchors, likes: tasteHints(item, taste, config) }),
    );

    const inList = list.filter((it) => plan.matched.has(it.id)).length;
    const notice =
      [
        plan.mode !== 'none' ? anchorNotice(anchors, plan.mode === 'filter' ? plan.matched.size : inList, config.result.size, domain.itemNounPlural, config.gender, plan.mode) : null,
        preferenceNotice(list, session.preferences, config, domain.itemNounPlural, config.result.size),
      ]
        .filter(Boolean)
        .join(' ') || null;
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

  /**
   * "Tu vibra": la persona arrastra barras y la lista se reordena dentro de la bolsa de la
   * entrevista (o del catálogo si no hubo bolsa), sin preguntar de nuevo y sin IA.
   * `scales` vacío o ausente vuelve a la lista original.
   */
  async revibe(sessionId: string, scales: Record<string, number> | undefined) {
    const session = await this.interviews.load(sessionId);
    if (!session.result || !session.profile) throw new BadRequestException('Esta entrevista todavía no tiene lista');
    const domain = await this.domains.get(session.domainId);
    const { config } = domain;
    const previous = session.result;
    const original = previous.vibe?.original ?? previous.entries;
    const moved = Object.fromEntries(Object.entries(scales ?? {}).filter(([k, v]) => Number.isFinite(v) && config.attributes.some((a) => a.key === k && a.kind === 'scale')));

    let result: SessionResult;
    if (!Object.keys(moved).length) {
      result = { ...previous, entries: original, vibe: null };
    } else {
      const base = applyRefinements(session.profile, previous.refinements, config);
      const profile = applyVibe(base, moved, config);
      const taste = hasTaste(session.taste) ? session.taste : null;
      const filters = preferenceFilters(session.preferences, config);
      const anchors = session.anchors ?? [];
      const excludedTags = new Set(config.tagGroups.filter((g) => session.exclusions?.includes(g.key)).flatMap((g) => g.tags));
      const catalog = (await this.items.catalog(domain.id, filters, session.userId)).filter((it) => !it.tags.some((t) => excludedTags.has(t)));
      const matched = anchorMatches(catalog, anchors);
      const mode = anchorMode(anchors, matched.length, config.result.size);
      const matchedIds = new Set(matched.map((m) => m.id));
      const byId = new Map(catalog.map((it) => [it.id, it]));
      let pool: { item: ItemWithoutEmbedding; boost: number }[];
      if (session.bag?.length) {
        const present = session.bag.filter((e) => byId.has(e.id));
        const weights = currentWeights(present, byId, session.turns, config, new Set(Object.keys(session.textSignals ?? {})));
        const pct = percentiles(weights);
        pool = present.map((e, i) => ({ item: byId.get(e.id)!, boost: pct[i] }));
      } else {
        pool = rankCandidates(catalog, profile, config, SEMANTIC_POOL, 2, taste).map(({ item }) => ({ item, boost: 0 }));
      }
      if (mode === 'filter') pool = pool.filter((p) => matchedIds.has(p.item.id));
      const ranked = reorderByVibe(pool, profile, config, {
        taste,
        moved: Object.keys(moved),
        perArtist: mode === 'filter' || anchors.some((a) => a.kind === 'creator') ? config.result.size : 2,
        extraBoost: mode === 'boost' ? (item) => (matchedIds.has(item.id) ? 1 : 0) : undefined,
      });
      const reasons = ranked.map(({ item }) => shortReason(item, { config, profile, anchors, likes: tasteHints(item, taste, config) }));
      result = {
        ...previous,
        entries: ranked.map(({ item, match }, i) => ({ itemId: item.id, match, fit: null, reason: reasons[i] })),
        vibe: { scales: moved, original },
      };
    }
    await this.db.update(interviewSessions).set({ result, updatedAt: new Date() }).where(eq(interviewSessions.id, session.id));
    this.logger.log(`Vibe ajustada (${Object.keys(moved).join(', ') || 'original'}): ${result.entries.length} elementos`);
    return this.result(sessionId);
  }

  async result(sessionId: string) {
    const session = await this.interviews.load(sessionId);
    if (!session.result || !session.profile) throw new BadRequestException('Esta entrevista todavía no tiene lista');
    const domain = await this.domains.get(session.domainId);
    const profile = applyVibe(applyRefinements(session.profile, session.result.refinements, domain.config), session.result.vibe?.scales, domain.config);
    const ids = session.result.entries.map((e) => e.itemId);
    const rows = ids.length ? await this.db.select().from(items).where(inArray(items.id, ids)) : [];
    const byId = new Map(rows.map((r) => [r.id, r]));

    return {
      id: session.id,
      domainId: session.domainId,
      title: session.result.title,
      answeredCount: answered(session.turns).length,
      chips: [
        ...(session.anchors ?? []).map((a) => `de ${a.label}`),
        ...signalChips(session.textSignals ?? {}, domain.config),
        ...answerChips(session.turns, domain.config),
      ],
      /** Lo concreto que pidió en el texto inicial ("Marvel"). */
      anchors: (session.anchors ?? []).map((a) => a.label),
      profile,
      /** "Tu vibra": de dónde sale cada dimensión, el contexto y si la persona ha movido barras. */
      vibe: {
        sources: vibeSources(domain.config, {
          textKeys: Object.keys(session.textSignals ?? {}),
          informed: profile.informed,
          hasTaste: hasTaste(session.taste),
          hasContext: !!(session.context.franja || session.context.tiempo),
        }),
        context: {
          franja: session.context.franja ?? null,
          diaSemana: session.context.diaSemana ?? null,
          finDeSemana: session.context.finDeSemana ?? false,
          tiempo: session.context.tiempo?.descripcion ?? null,
        },
        adjusted: Object.keys(session.result.vibe?.scales ?? {}),
      },
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
      /** Cuántos de la lista van con los gustos de la persona. */
      likedCount: session.result.entries.filter((e) => tasteHints(byId.get(e.itemId) ?? { tags: [] }, session.taste, domain.config).length > 0).length,
      /** Lista ya creada en la cuenta de YouTube de la persona (solo en "Mi YouTube"). */
      youtube: session.result.youtube ?? null,
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
    plan: AnchorPlan,
  ): Promise<HybridCandidate<ItemWithoutEmbedding>[]> {
    const { config } = domain;
    if (session.bag?.length) return this.findInBag(session, domain, profile, catalog, taste, plan);
    // Con `filter`, la bolsa es solo lo que pidió; si no, lo que pidió entra siempre y sube.
    const scope = plan.mode === 'filter' ? catalog.filter((it) => plan.matched.has(it.id)) : catalog;
    const byAttributes = rankCandidates(scope, profile, config, SEMANTIC_POOL / 2, 2, taste);
    const query = [profileQueryText(profile, config, domain.itemNounPlural, session.initialText), anchorQueryText(plan.anchors)]
      .filter(Boolean)
      .join('. ');
    const options = {
      taste,
      // Con un artista o autor pedido, todo puede ser suyo: no se limita por creador.
      perArtist: plan.mode === 'filter' || plan.anchors.some((a) => a.kind === 'creator') ? config.result.size : 2,
      boost:
        plan.mode === 'boost'
          ? (item: ItemWithoutEmbedding) => {
              const { score } = bestAnchor(item, plan.anchors);
              return score >= ANCHOR_MATCH ? ANCHOR_BOOST * score : 0;
            }
          : undefined,
    };
    const extra = catalog.filter((it) => plan.matched.has(it.id));
    const vector = await this.embeddings
      .embed([query], 'query')
      .then(([v]) => v)
      .catch((error: Error) => {
        this.logger.warn(`Sin búsqueda semántica: ${error.message}`);
        return null;
      });
    if (!vector) {
      const pool = new Map(byAttributes.map(({ item }) => [item.id, { item, semantic: null as number | null }]));
      for (const item of extra) if (!pool.has(item.id)) pool.set(item.id, { item, semantic: null });
      return hybridRank([...pool.values()], profile, config, config.result.candidates, options);
    }

    const nearest = await this.items.nearest(domain.id, vector, SEMANTIC_POOL, { filters, userId: session.userId });
    const pool = new Map<string, { item: ItemWithoutEmbedding; semantic: number | null }>(
      nearest
        .filter((n) => plan.mode !== 'filter' || plan.matched.has(n.id))
        .map(({ semantic, ...item }) => [item.id, { item, semantic: Number(semantic) }]),
    );
    const missing = [...byAttributes.map(({ item }) => item), ...extra].filter((item, i, all) => !pool.has(item.id) && all.findIndex((x) => x.id === item.id) === i);
    const sims = await this.items.similarities(
      domain.id,
      missing.map((i) => i.id),
      vector,
      session.userId,
    );
    for (const item of missing) pool.set(item.id, { item, semantic: sims.get(item.id) ?? null });
    this.logger.log(`Consulta semántica: "${query}" → ${pool.size - missing.length} vecinos + ${missing.length} por atributos o por ancla`);
    return hybridRank([...pool.values()], profile, config, config.result.candidates, options);
  }

  /**
   * Entrevista guiada por candidatas: la lista sale de la MISMA bolsa por la que se preguntó,
   * con los pesos que dejaron las respuestas como empujón sobre el ranking híbrido (atributos
   * + semántica + gustos). Nada de fuera de la bolsa: respeta filtros, anclas y exclusiones.
   */
  private async findInBag(
    session: SessionRow,
    domain: DomainRow,
    profile: MoodProfile,
    catalog: ItemWithoutEmbedding[],
    taste: TasteProfile | null,
    plan: AnchorPlan,
  ): Promise<HybridCandidate<ItemWithoutEmbedding>[]> {
    const { config } = domain;
    const byId = new Map(catalog.map((it) => [it.id, it]));
    const present = (session.bag ?? []).filter((e) => byId.has(e.id));
    const weights = currentWeights(present, byId, session.turns, config, new Set(Object.keys(session.textSignals ?? {})));
    const pct = percentiles(weights);
    const boost = new Map(present.map((e, i) => [e.id, BAG_BOOST * pct[i]]));
    const query = [profileQueryText(profile, config, domain.itemNounPlural, session.initialText), anchorQueryText(plan.anchors)].filter(Boolean).join('. ');
    const vector = await this.embeddings
      .embed([query], 'query')
      .then(([v]) => v)
      .catch((error: Error) => {
        this.logger.warn(`Sin búsqueda semántica: ${error.message}`);
        return null;
      });
    const sims = vector ? await this.items.similarities(domain.id, present.map((e) => e.id), vector, session.userId) : new Map<string, number | null>();
    const pool = present.map((e) => ({ item: byId.get(e.id)!, semantic: sims.get(e.id) ?? null }));
    this.logger.log(`Lista desde la bolsa: ${pool.length} candidatas${vector ? ' + parecido semántico' : ''}`);
    return hybridRank(pool, profile, config, config.result.candidates, {
      taste,
      perArtist: plan.mode === 'filter' || plan.anchors.some((a) => a.kind === 'creator') ? config.result.size : 2,
      boost: (item) => boost.get(item.id) ?? 0,
    });
  }

  /**
   * Título de la lista (lo único que redacta la IA aquí: el "por qué" de cada elemento se
   * construye con plantillas a partir de datos concretos, ver `shortReason`).
   */
  private async title(profile: MoodProfile, domain: DomainRow, list: ItemWithoutEmbedding[], anchors: Anchor[]) {
    const { config } = domain;
    const written = await this.text
      .write({
        system: `${config.voice} Pones títulos cortos y con gancho, en tono cercano pero cuidado y sin jerga, a listas de ${domain.itemNounPlural}.`,
        prompt: [
          anchors.length ? `Ha pedido: ${anchors.map((a) => a.label).join(', ')}.` : null,
          `Lo que busca: ${profile.summary.join(', ') || 'sin preferencias claras'}.`,
          `${capitalize(domain.itemNounPlural)}: ${list.slice(0, 6).map((it) => `«${it.title}»`).join(', ')}.`,
          'Devuelve un título de 2 a 4 palabras, en español, sin comillas ni cifras.',
        ]
          .filter(Boolean)
          .join('\n'),
        schema: titleSchema,
      })
      .catch((error: Error) => {
        // Sin texto, la lista se guarda igual con un título genérico.
        this.logger.warn(`Título: ${error.message.slice(0, 120)}`);
        return null;
      });
    return written?.title.trim().replace(/^[«"']|[»"']$/g, '') || 'Tu lista';
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
    // Si el proveedor está caído o sin cupo, el perfil sale de las respuestas: la lista sale igual.
    const decided = await this.decisions
      .decide({ respuestas: answers, ...stateExtras(session, config) }, questions)
      .then((result) => ({
        scales: Object.fromEntries(scales.map((a) => [a.key, round((result[`scale_${a.key}`] as { score: number }).score)])),
        tagGroups: Object.fromEntries(
          config.tagGroups.map((g) => [g.key, round((result[`tags_${g.key}`] as { probability: number }).probability)]),
        ),
      }))
      .catch((error: Error) => {
        this.logger.warn(`Perfil sin IA (a partir de las respuestas): ${error.message.slice(0, 120)}`);
        return answersProfile(session.turns, config, session.textSignals ?? {});
      });
    const profile: MoodProfile = {
      ...decided,
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
