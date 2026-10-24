import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { INTERVIEW_DECISION_PROVIDER, type DecisionProvider } from '../ai/decision-provider.js';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from '../ai/embedding-provider.js';
import { TEXT_PROVIDER, type TextProvider } from '../ai/text-provider.js';
import { emitTrace } from '../ai/trace-context.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions, type SessionRow } from '../db/schema.js';
import { DomainsService, type DomainRow } from '../domains/domains.service.js';
import { config as env } from '../config.js';
import { domainDefinitions } from '../domains/index.js';
import { ItemsService, type ItemWithoutEmbedding } from '../items/items.service.js';
import type { Probe } from '../domains/domain.types.js';
import { hasTaste, tasteLabel, tasteOnlyProbes, withoutOff } from '../taste/taste.engine.js';
import { TasteService } from '../taste/taste.service.js';
import type { FacetFilter } from './interview.engine.js';
import { collectContext, contextKey, stateExtras, type ContextRequest, type InterviewContext } from './interview.context.js';
import {
  answerChips,
  answered,
  canFinishEarly,
  informedDimensions,
  minQuestions,
  mustFinish,
  pending,
  preferenceFilters,
  profileConfidence,
  signalChips,
} from './interview.engine.js';
import { buildBag, coveredProbes, effectiveCount, currentWeights, planNext } from './candidates.js';
import { anchorsDone, askableProbes, assertNotAsked, autoAnswerExhausted, type InterviewFacts } from './interview.flow.js';
import { NextQuestionPrefetch } from './interview.prefetch.js';
import { anchorExample, anchorMatches, anchorQueryText, cleanAnchors, isStructured, probeDirection, seedIds } from './anchors.js';
import { anchorsFromEntities, entityIndex, findEntities, pickWithoutAI } from './catalog-match.js';
import { withCues } from './text-cues.js';
import { NONSENSE, replySummary } from './reply.js';
import { normalize } from './interview.engine.js';
import { anchorTag } from '../catalog/catalog-adapter.js';
import { AnchorsService, START_COVERAGE_WAIT_MS, type AnchorFocus } from './anchors.service.js';
import { SimilarService } from './similar.service.js';
import { QuestionBankService } from './question-bank.service.js';
import type { Anchor, Answer, BagEntry, EditedUnderstanding, InterviewTurn, ReplySnapshot, Understanding } from './interview.types.js';
import { PreferencesService } from './preferences.service.js';
import { emptyUnderstanding, signalsOf, UnderstandingService } from './understanding.service.js';

const ANSWER_TEXT: Record<Answer, string> = { yes: 'sí', no: 'no', unknown: 'no lo sé' };
const FINISH = 'finish';
const FIRST_QUESTION_TTL_MS = 30 * 60_000;
/** Cuánto espera la bolsa al parecido semántico con el texto antes de seguir sin él. */
const SEMANTIC_WAIT_MS = 5_000;
const BAG_CACHE = 200;
/** Por debajo de esta confianza, la respuesta automática se queda en "no lo sé". */
const AUTO_CONFIDENCE = 0.6;
const contextDefaults = () => ({ timeZone: env.contextTimeZone, latitude: env.contextLatitude, longitude: env.contextLongitude });

/** Sin formato markdown y sin frases tras la interrogación ("¿…? Es lo que más las distingue."). */
export const tidyQuestion = (q: string) => {
  const clean = q.replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
  const end = clean.indexOf('?');
  return end > 0 ? clean.slice(0, end + 1) : clean;
};

type SessionSeed = Pick<SessionRow, 'context' | 'initialText' | 'taste' | 'textSignals' | 'anchors' | 'userId' | 'exclusions' | 'bag' | 'preferences' | 'tasteOff'>;

export interface StartOptions {
  /** Punto de partida opcional (texto o voz transcrita). Se trata como dato, nunca como instrucción. */
  initialText?: string;
  /** Persona anónima, para usar sus gustos. */
  userId?: string | null;
  /** Zona horaria y posición aproximada que manda el navegador. */
  client?: ContextRequest;
  /** Preferencias elegidas con los botones (idioma, plataforma…): ganan a las deducidas del texto. */
  preferences?: Record<string, string>;
  /** Gustos guardados (etiqueta o `@grupo`) que la persona desactivó solo para esta entrevista. */
  tasteOff?: string[];
  /** Lo entendido del texto ya corregido por la persona; si falta, se entiende aquí. */
  understanding?: EditedUnderstanding;
}

export interface SessionView {
  id: string;
  domainId: string;
  status: SessionRow['status'];
  step: number;
  minQuestions: number;
  maxQuestions: number;
  confidence: number;
  chips: string[];
  question: { text: string; lead: string; reason: string; guess: string; chips: { yes: string; no: string } } | null;
  canUndo: boolean;
  decisionProvider: string;
  /** Hora, día y tiempo con los que se adapta la entrevista. */
  context: InterviewContext;
  /** Lo que ya dejó claro el texto inicial ("tranquilo"): no se pregunta. */
  fromText: string[];
  /** Gustos de largo plazo que se están teniendo en cuenta. */
  taste: string[];
  /** Lo concreto que pidió en el texto inicial ("Marvel"): la búsqueda y las preguntas se centran en ello. */
  anchors: string[];
  /** Filtros previos activos ("Nintendo") y lo que no quiere ("terror"). */
  filters: string[];
  excluded: string[];
  /** Candidatas que quedan (masa efectiva de la bolsa) y cuántas había; null sin bolsa. */
  candidates: { left: number; total: number } | null;
}

export interface AutoAnswer {
  question: string;
  answer: Answer;
  confidence: number | null;
  session: SessionView;
}

@Injectable()
export class InterviewService implements OnModuleInit {
  private readonly logger = new Logger('Entrevista');
  private readonly prefetch = new NextQuestionPrefetch();
  /** La primera pregunta no depende de nada (sin texto inicial ni contexto): se prepara una vez por dominio. */
  private readonly firstQuestion = new Map<string, { turns: Promise<InterviewTurn[]>; at: number }>();
  /** Elementos de la bolsa de cada sesión (no cambian durante la entrevista). */
  private readonly bagCache = new Map<string, Promise<Map<string, ItemWithoutEmbedding>>>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(INTERVIEW_DECISION_PROVIDER) private readonly decisions: DecisionProvider,
    @Inject(TEXT_PROVIDER) private readonly text: TextProvider,
    private readonly domains: DomainsService,
    private readonly bank: QuestionBankService,
    private readonly tastes: TasteService,
    private readonly anchors: AnchorsService,
    private readonly similar: SimilarService,
    private readonly understanding: UnderstandingService,
    private readonly prefs: PreferencesService,
    private readonly items: ItemsService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {}

  /** Carga el banco de preguntas y calienta la primera pregunta al arrancar, sin bloquear el arranque. */
  onModuleInit() {
    for (const d of domainDefinitions) {
      this.domains
        .get(d.id)
        .then(async (domain) => {
          await this.bank.load(domain);
          return this.firstTurns(domain, await collectContext({}, contextDefaults()));
        })
        .catch((error: Error) => this.logger.warn(`No he podido preparar la primera pregunta de ${d.id}: ${error.message}`));
    }
  }

  /**
   * Lo que se entiende del texto, sin crear la sesión (la tarjeta "Esto es lo que he entendido").
   * Arranca ya la búsqueda en directo de lo que pidió, así llega caliente a la primera pregunta.
   */
  async understand(domainId: string, text: string, userId: string | null = null): Promise<Understanding & { searching: string[] }> {
    const domain = await this.domains.get(domainId);
    const understood = await this.comprehend(domain, text.trim(), userId);
    // Lo que falta en el catálogo se empieza a buscar ya (completo); al empezar se espera.
    const gap = await this.anchors.coverageGap(domain, understood.anchors, userId);
    if (gap.length) void this.anchors.ensureCoverage(domain, gap, userId);
    return { ...understood, searching: gap.map((a) => a.label) };
  }

  /**
   * Entender contra el catálogo: primero se buscan en el catálogo las entidades REALES que
   * nombra el texto (títulos, creadores, compañías, colecciones, sagas, etiquetas) y la IA
   * elige entre ellas; lo que no esté se buscará fuera. Sin IA, se eligen por reglas.
   */
  private async comprehend(domain: DomainRow, text: string, userId: string | null, question?: string): Promise<Understanding> {
    const catalog = await this.items.catalog(domain.id, [], userId);
    const index = entityIndex(catalog, domain.config, { titleFamilies: !domain.config.playable });
    const entities = findEntities(text, catalog, domain.config, index);
    this.logger.log(`Entidades del catálogo en el texto: ${entities.map((e) => `${e.name} (${e.kind}, ${e.count})`).join(', ') || 'ninguna'}`);
    // Lo más común ("para entrenar", "sin letra") se entiende también sin IA.
    return withCues(await this.understanding.understand(domain, text, entities, question), domain.id, text, domain.config);
  }

  /**
   * Después de buscar fuera: lo que era solo texto se vuelve a resolver contra el catálogo ya
   * ampliado (p. ej. "Marvel" → productora Marvel Studios) y a todo se le suma la etiqueta con
   * la que la búsqueda en directo marcó lo que trajo.
   */
  private async resolveAgain(domain: DomainRow, anchors: Anchor[], searched: Anchor[], userId: string | null): Promise<Anchor[]> {
    const catalog = await this.items.catalog(domain.id, [], userId);
    const index = entityIndex(catalog, domain.config, { titleFamilies: !domain.config.playable });
    const tagged = new Set(searched.map((a) => a.label));
    return anchors.map((a) => {
      let out = a;
      if (!isStructured(a)) {
        const entities = findEntities([a.label, ...a.terms.slice(0, 2)].join(' . '), catalog, domain.config, index);
        const [resolved] = anchorsFromEntities(entities, pickWithoutAI(a.label, entities));
        if (resolved) out = { ...resolved, label: a.label, required: a.required || resolved.kind === 'title' };
      }
      if (tagged.has(a.label) && out.kind !== 'title') {
        const tag = anchorTag(a);
        const match = out.match ?? [];
        if (!match.some((c) => c.field === 'tags' && c.values.includes(tag))) out = { ...out, match: [...match, { field: 'tags', values: [tag] }] };
      }
      return out;
    });
  }

  async start(domainId: string, { initialText, userId = null, client = {}, preferences: chosen = {}, tasteOff = [], understanding: edited }: StartOptions = {}): Promise<SessionView> {
    const domain = await this.domains.get(domainId);
    const { config } = domain;
    const text = initialText?.trim() || null;
    const [context, taste, understood] = await Promise.all([
      collectContext(client, contextDefaults()),
      this.tastes.profile(userId, domainId),
      edited ? Promise.resolve(this.fromEdited(edited, domain)) : text ? this.comprehend(domain, text, userId) : emptyUnderstanding(),
    ]);
    const { exclusions } = understood;
    let { anchors } = understood;
    // Si el catálogo se queda corto para lo que pidió, se busca en directo y COMPLETO antes de
    // montar la bolsa ("todas las de Marvel"), con tope de espera; luego se vuelve a resolver.
    if (anchors.length) {
      const gap = await this.anchors.coverageGap(domain, anchors, userId);
      if (gap.length) await this.anchors.awaitCoverage(domain, gap, userId, START_COVERAGE_WAIT_MS);
      if (gap.length || anchors.some((a) => !isStructured(a))) anchors = await this.resolveAgain(domain, anchors, gap, userId);
      // "Parecido a X" (y estilos en música): relacionados que propone la IA y existen de verdad.
      if (text) anchors = await this.similar.expand(domain, anchors, text, userId);
    }
    const preferences = this.prefs.merge(domain, chosen, understood.preferences);
    let filters = preferenceFilters(preferences, config);
    // Lo pedido por su nombre gana a un filtro de los botones que lo deja a cero ("Marvel" con
    // idioma original español): ese filtro no se aplica en esta entrevista.
    const hard = anchors.filter((a) => a.required && a.kind !== 'title' && isStructured(a));
    if (hard.length && filters.length) {
      const [all, kept] = await Promise.all([this.items.catalog(domainId, [], userId), this.items.catalog(domainId, filters, userId)]);
      if (!anchorMatches(kept, hard).length && anchorMatches(all, hard).length) {
        this.logger.log(`Filtros ${filters.map((f) => f.key).join(', ')} quitados: dejaban a cero ${hard.map((a) => a.label).join(', ')}`);
        for (const f of filters) {
          const pref = config.preferences?.find((p) => p.key === f.key);
          if (pref) preferences[f.key] = { value: pref.anyValue, source: 'user', confidence: null };
        }
        filters = [];
      }
    }
    const textSignals = signalsOf(understood);
    const seed: SessionSeed = {
      context,
      initialText: text,
      taste: withoutOff(hasTaste(taste) ? taste : null, tasteOff),
      tasteOff,
      textSignals,
      anchors,
      userId,
      exclusions,
      preferences,
      bag: null,
    };
    // Con texto, filtros, exclusiones o gustos, la entrevista se guía por una bolsa de candidatas.
    let loaded: Map<string, ItemWithoutEmbedding> | undefined;
    if (text || filters.length || exclusions.length || anchors.length || seed.taste) {
      const semantic = text ? await this.semanticMap(domain, text, anchors, filters, userId) : undefined;
      const made = await this.makeBag(domain, seed, filters, semantic);
      if (made) ({ bag: seed.bag, loaded } = made);
    }
    // Sin texto ni gustos ni bolsa, la primera pregunta solo depende del contexto: se reutiliza.
    const generic = !seed.initialText && !seed.taste && !seed.bag;
    const turns = generic ? await this.firstTurns(domain, context) : await this.advance([], domain, seed, loaded);
    const [row] = await this.db.insert(interviewSessions).values({ domainId, turns, ...seed }).returning();
    if (loaded) this.bagCache.set(row.id, Promise.resolve(loaded));
    this.schedulePrefetch(row, domain);
    this.traceGain(row);
    return this.view(row, domain);
  }

  /** Bolsa de candidatas con los filtros, anclas, exclusiones, señales y gustos de la sesión (null si queda vacía). */
  private async makeBag(domain: DomainRow, seed: SessionSeed, filters: FacetFilter[], semantic?: Map<string, number>) {
    const filtered = await this.items.catalog(domain.id, filters, seed.userId);
    // Los títulos pedidos entran aunque un filtro los deje fuera (los pidió por su nombre).
    const seeds = seedIds(seed.anchors ?? []).filter((id) => !filtered.some((it) => it.id === id));
    const catalog = seeds.length ? [...filtered, ...(await this.items.byIds(domain.id, seeds, seed.userId))] : filtered;
    const bag = buildBag(catalog, {
      config: domain.config,
      signals: seed.textSignals ?? {},
      anchors: seed.anchors ?? [],
      exclusions: seed.exclusions ?? [],
      filters,
      taste: seed.taste,
      semantic,
    });
    this.logger.log(`Bolsa: ${bag.entries.length} de ${catalog.length} (anclas: ${bag.mode}, ${bag.matched} coinciden)`);
    if (!bag.entries.length) return null;
    const byId = new Map(catalog.map((it) => [it.id, it]));
    return { bag: bag.entries, loaded: new Map(bag.entries.map((e) => [e.id, byId.get(e.id)!])) };
  }

  /**
   * Respuesta libre a la pregunta pendiente ("no, más romántico", "como Bad Bunny pero lento",
   * "eso no tiene sentido"). Pasa por el mismo "entender contra el catálogo" con la pregunta como
   * contexto y se convierte en cambios estructurados (ánimo, anclas, exclusiones) que rehacen la
   * bolsa; el turno guarda lo que había antes para deshacerlo. El texto no se guarda.
   */
  async reply(id: string, text: string, step?: number): Promise<SessionView> {
    const row = await this.load(id);
    const domain = await this.domains.get(row.domainId);
    const current = pending(row.turns);
    if (row.status !== 'asking' || !current) throw new ConflictException('Esta entrevista no tiene una pregunta pendiente');
    const answeredCount = answered(row.turns).length;
    if (step !== undefined && step !== answeredCount + 1) throw new ConflictException('Esa respuesta es de una pregunta anterior');
    this.prefetch.forget(row.id);

    const before: ReplySnapshot = { textSignals: row.textSignals ?? {}, exclusions: row.exclusions ?? [], anchors: row.anchors ?? [], bag: row.bag ?? null };
    let next: ReplySnapshot = before;
    let answer: Answer = 'unknown';
    let summary: string;
    let dropped: InterviewTurn | undefined;
    const clean = text.trim().slice(0, 300);
    if (NONSENSE.test(normalize(clean))) {
      // "No tiene sentido": se descarta lo último que se entendió de una respuesta libre y se pregunta otra cosa.
      dropped = [...answered(row.turns)].reverse().find((t) => t.reply && !t.reply.dropped);
      if (dropped?.reply) next = dropped.reply.before;
      summary = dropped?.reply ? `descarto «${dropped.reply.summary}» y pregunto otra cosa` : 'pregunto otra cosa';
    } else {
      const understood = await this.comprehend(domain, clean, row.userId, current.text);
      answer = understood.answer ?? 'unknown';
      const merged = cleanAnchors([...understood.anchors, ...before.anchors.filter((a) => !understood.anchors.some((n) => normalize(n.label) === normalize(a.label)))]);
      let anchors = merged;
      if (understood.anchors.length) {
        const gap = await this.anchors.coverageGap(domain, understood.anchors, row.userId);
        if (gap.length) await this.anchors.awaitCoverage(domain, gap, row.userId, START_COVERAGE_WAIT_MS);
        if (gap.length || merged.some((a) => !isStructured(a))) anchors = await this.resolveAgain(domain, merged, gap, row.userId);
        anchors = await this.similar.expand(domain, anchors, clean, row.userId);
      }
      next = {
        textSignals: { ...before.textSignals, ...signalsOf(understood) },
        exclusions: [...new Set([...before.exclusions, ...understood.exclusions])],
        anchors,
        bag: before.bag,
      };
      summary = replySummary(understood, answer, domain.config) || 'lo tengo en cuenta';
    }
    const changed = JSON.stringify({ ...next, bag: null }) !== JSON.stringify({ ...before, bag: null });
    const session = { ...row, ...next };
    let loaded: Map<string, ItemWithoutEmbedding> | undefined;
    if (changed) {
      const made = await this.makeBag(domain, session, preferenceFilters(row.preferences, domain.config));
      session.bag = made?.bag ?? null;
      loaded = made?.loaded;
      this.bagCache.delete(row.id);
      if (loaded) this.bagCache.set(row.id, Promise.resolve(loaded));
    }
    const base = row.turns.map((t) =>
      t === current
        ? { ...t, answer, reply: { summary, before } }
        : t === dropped && t.reply
          ? { ...t, reply: { ...t.reply, dropped: true } }
          : t,
    );
    const turns = await this.advance(base, domain, session, loaded);
    const asked = pending(turns);
    if (asked) asked.lead = `Vale: ${summary}.`;
    this.logger.log(`Respuesta libre ${answeredCount + 1} → ${summary} (${answer})`);
    const status = asked ? 'asking' : 'ready';
    const saved = await this.save(row, { turns, status, textSignals: session.textSignals, exclusions: session.exclusions, anchors: session.anchors, bag: session.bag });
    if (status === 'asking') {
      this.schedulePrefetch(saved, domain);
      this.traceGain(saved);
    }
    return this.view(saved, domain);
  }

  /** La corrección de la persona, validada contra el dominio (confianza total: lo ha visto y aceptado). */
  private fromEdited(edited: EditedUnderstanding, domain: DomainRow): Understanding {
    const { config } = domain;
    const scales = new Set(config.attributes.filter((a) => a.kind === 'scale').map((a) => a.key));
    const groups = new Set(config.tagGroups.map((g) => g.key));
    return {
      moods: edited.moods.filter((m) => scales.has(m.key)).map((m) => ({ ...m, confidence: 1 })),
      anchors: cleanAnchors(edited.anchors),
      preferences: Object.fromEntries(Object.entries(edited.preferences).map(([k, value]) => [k, { value, confidence: 1 }])),
      exclusions: edited.exclusions.filter((g) => groups.has(g)),
    };
  }

  /** Parecido semántico del texto con el catálogo, si hay cupo de embeddings; si no, nada. */
  private async semanticMap(domain: DomainRow, text: string, anchors: Anchor[], filters: FacetFilter[], userId: string | null) {
    const query = [`${domain.itemNounPlural}. Cómo se siente: ${text.slice(0, 300)}`, anchorQueryText(anchors)].filter(Boolean).join('. ');
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), SEMANTIC_WAIT_MS));
    const found = this.embeddings
      .embed([query], 'query')
      .then(([vector]) => this.items.nearest(domain.id, vector, 150, { filters, userId }))
      .then((rows) => new Map(rows.map((r) => [r.id, Number(r.semantic)])))
      .catch((error: Error) => {
        this.logger.warn(`Bolsa sin parecido semántico: ${error.message.slice(0, 100)}`);
        return null;
      });
    return (await Promise.race([found, timeout])) ?? undefined;
  }

  async get(id: string): Promise<SessionView> {
    const row = await this.load(id);
    return this.view(row, await this.domains.get(row.domainId));
  }

  /**
   * Responde la pregunta pendiente. `step` (el número de pregunta que ve el cliente)
   * protege contra dobles envíos: si ya no coincide, la respuesta llegó tarde.
   */
  async answer(id: string, answer: Answer, step?: number, { finish = false } = {}): Promise<SessionView> {
    const row = await this.load(id);
    const domain = await this.domains.get(row.domainId);
    const current = pending(row.turns);
    if (row.status !== 'asking' || !current) throw new ConflictException('Esta entrevista no tiene una pregunta pendiente');
    const answeredCount = answered(row.turns).length;
    if (step !== undefined && step !== answeredCount + 1) {
      throw new ConflictException('Esa respuesta es de una pregunta anterior');
    }

    const base = row.turns.map((t) => (t === current ? { ...t, answer } : t));
    if (finish) {
      this.prefetch.forget(row.id);
      return this.view(await this.save(row, { turns: base, status: 'ready' }), domain);
    }
    const started = Date.now();
    const prefetched = this.prefetch.take(row.id, answeredCount, answer);
    const turns = prefetched
      ? await prefetched.catch(() => this.advance(base, domain, row))
      : await this.advance(base, domain, row);
    this.logger.log(`Respuesta ${answeredCount + 1} → siguiente en ${Date.now() - started} ms${prefetched ? ' (precargada)' : ''}`);

    const status = pending(turns) ? 'asking' : 'ready';
    const saved = await this.save(row, { turns, status });
    if (status === 'asking') {
      this.schedulePrefetch(saved, domain);
      this.traceGain(saved);
    }
    return this.view(saved, domain);
  }

  /** Deja en las trazas de "Bajo el capó" la ganancia de la pregunta planteada (solo metadatos). */
  private traceGain(row: SessionRow) {
    const current = pending(row.turns);
    if (current?.gain === undefined) return;
    emitTrace({
      sessionId: row.id,
      task: 'ganancia',
      subject: current.probeId,
      provider: 'motor',
      model: null,
      ok: true,
      skipped: [],
      latencyMs: 0,
      totalMs: 0,
      inputTokens: null,
      outputTokens: null,
      outcome: `${current.gain.toFixed(2)} bits · quedan ~${current.left ?? '?'}`,
    });
  }

  /**
   * Responde la pregunta pendiente a partir del texto inicial, como lo haría la persona
   * (para clientes sin pantalla, como el servidor MCP). Lo decide la cadena rápida de la
   * entrevista con un `choice` de sí / no / no lo sé; el texto va en el `state` como dato.
   * Si el texto no lo deja claro, responde "no lo sé", que no inventa nada en el perfil.
   */
  async autoAnswer(id: string): Promise<AutoAnswer> {
    const row = await this.load(id);
    const current = pending(row.turns);
    if (row.status !== 'asking' || !current) throw new ConflictException('Esta entrevista no tiene una pregunta pendiente');
    if (!row.initialText) throw new BadRequestException('Para responder sola, la entrevista necesita un texto inicial');
    const domain = await this.domains.get(row.domainId);
    const probe = domain.config.probes.find((p) => p.id === current.probeId);

    const { answer: decided } = await this.decisions.decide(
      {
        pregunta: current.text,
        siSignifica: probe?.intent ?? current.text,
        ...stateExtras(row, domain.config),
      },
      {
        answer: {
          type: 'choice',
          instructions: `Responde a la pregunta como lo haría esta persona según su texto inicial, pensando en lo que le apetece ${domain.config.verb} ahora. Si el texto no da pistas suficientes, elige "unknown".`,
          criteria: { yes: 'Sí', no: 'No', unknown: 'No lo sé: el texto no lo deja claro' },
        },
      },
    );
    const confidence = decided.confidence ?? null;
    const answer: Answer =
      decided.choice === 'yes' || decided.choice === 'no' ? (confidence !== null && confidence < AUTO_CONFIDENCE ? 'unknown' : decided.choice) : 'unknown';
    const step = answered(row.turns).length + 1;
    const finish = autoAnswerExhausted(row.turns, answer, domain.config, Object.keys(row.textSignals ?? {}));
    this.logger.log(`Respuesta automática ${step}: ${current.probeId} → ${answer}${confidence !== null ? ` (${confidence})` : ''}${finish ? ', fin' : ''}`);
    return { question: current.text, answer, confidence, session: await this.answer(id, answer, step, { finish }) };
  }

  /** Deshace la última respuesta: esa pregunta vuelve a quedar pendiente. */
  async undo(id: string): Promise<SessionView> {
    const row = await this.load(id);
    const done = answered(row.turns);
    if (!done.length) throw new BadRequestException('No hay respuestas que deshacer');
    const last = done[done.length - 1];
    const turns = row.turns.filter((t) => t.answer !== null).map((t) => (t === last ? { ...t, answer: null, reply: undefined } : t));
    this.prefetch.forget(row.id);
    const domain = await this.domains.get(row.domainId);
    // Deshacer una respuesta libre devuelve lo que había antes de entenderla (ánimo, anclas, bolsa).
    const restore = last.reply ? { ...last.reply.before } : {};
    if (last.reply) this.bagCache.delete(row.id);
    const saved = await this.save(row, { turns, status: 'asking', profile: null, result: null, ...restore });
    this.schedulePrefetch(saved, domain);
    return this.view(saved, domain);
  }

  async load(id: string): Promise<SessionRow> {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException('Entrevista no encontrada');
    const [row] = await this.db.select().from(interviewSessions).where(eq(interviewSessions.id, id));
    if (!row) throw new NotFoundException('Entrevista no encontrada');
    return row;
  }

  /** Primera pregunta por dominio y contexto (franja, día y tiempo), reutilizable durante un rato. */
  private firstTurns(domain: DomainRow, context: InterviewContext): Promise<InterviewTurn[]> {
    const key = `${domain.id}|${contextKey(context)}`;
    const cached = this.firstQuestion.get(key);
    if (cached && Date.now() - cached.at < FIRST_QUESTION_TTL_MS) return cached.turns;
    const turns = this.advance([], domain, { context, initialText: null, taste: null, textSignals: {}, anchors: [], userId: null, exclusions: [], bag: null, preferences: {}, tasteOff: [] });
    turns.catch(() => this.firstQuestion.delete(key));
    this.firstQuestion.set(key, { turns, at: Date.now() });
    return turns;
  }

  /** Lo que ya se sabe antes de preguntar: dimensiones del texto y sondas de gustos que sobran. */
  private facts(session: SessionSeed, domain: DomainRow): InterviewFacts {
    return {
      known: Object.keys(session.textSignals ?? {}),
      // Con bolsa, solo sobran las preguntas de estilos que los gustos ya cubren; sin ella, todas las de estilo.
      skip: session.taste ? (session.bag?.length ? coveredProbes(session.taste, domain.config) : tasteOnlyProbes(domain.config)) : undefined,
      noStyles: !!session.taste || !!session.anchors?.length,
    };
  }

  /** Mientras la persona lee la pregunta, prepara la siguiente para "sí" y para "no". */
  private schedulePrefetch(row: SessionRow, domain: DomainRow) {
    const current = pending(row.turns);
    if (!current) return;
    const answeredCount = answered(row.turns).length;
    for (const answer of ['yes', 'no'] as const) {
      const base = row.turns.map((t) => (t === current ? { ...t, answer } : t));
      this.prefetch.start(row.id, answeredCount, answer, () => this.advance(base, domain, row));
    }
  }

  /**
   * Decide la siguiente pregunta (o terminar). La decisión la toma la cadena de la
   * entrevista (por defecto Groq → Laya → Gemini; ver DECISION_CHAIN) entre las preguntas
   * que aún aportan algo (`askableProbes`). El texto sale del banco pregenerado: una sola
   * llamada por pregunta. Si la sonda no tiene banco, el TextProvider la redacta en vivo.
   */
  private async advance(
    turns: InterviewTurn[],
    domain: DomainRow,
    session: SessionSeed & { id?: string },
    loaded?: Map<string, ItemWithoutEmbedding>,
  ): Promise<InterviewTurn[]> {
    if (session.bag?.length) return this.advanceGuided(turns, domain, session, session.bag, loaded);
    const { config } = domain;
    const facts = this.facts(session, domain);
    const known = facts.known ?? [];
    if (answered(turns).length && mustFinish(turns, config, known)) return turns;

    let options = askableProbes(turns, config, facts);
    if (!options.length) return turns;
    const informed = informedDimensions(turns, config, known);
    // Con anclas, se pregunta primero por lo que más separa a sus elementos (p. ej. entre las
    // de Marvel, el humor), si quedan preguntas que lo informen.
    const focus = await this.anchorFocus(session, domain);
    const focusDims = (focus?.dimensions ?? []).filter((d) => !informed.has(d)).slice(0, 2);
    const focused = options.filter((p) => p.informs.some((d) => focusDims.includes(d)));
    if (focused.length) options = focused;
    // Ya no queda nada que distinga a lo que pidió: mejor la lista que preguntas de relleno.
    if (anchorsDone(session.anchors?.length ?? 0, focus !== null, focused.length, answered(turns).length, 'exhausted')) {
      this.logger.log(`terminar: ya no quedan preguntas que distingan ${session.anchors.map((a) => a.label).join(', ')}`);
      return turns;
    }
    // Con algo concreto pedido, sobran las preguntas que solo preguntan por estilos ("¿carreras?").
    const tagDims = new Set(config.attributes.filter((a) => a.kind === 'tags').map((a) => a.key));
    const moodOnly = session.anchors?.length ? options.filter((p) => p.informs.some((d) => !tagDims.has(d))) : options;
    if (moodOnly.length) options = moodOnly;
    const history = answered(turns).map((t) => ({ pregunta: t.text, respuesta: ANSWER_TEXT[t.answer!] }));

    const criteria: Record<string, string> = Object.fromEntries(options.map((p) => [p.id, `Preguntar ${p.intent.toLowerCase()}`]));
    if (canFinishEarly(turns, config, known)) criteria[FINISH] = 'Terminar: ya hay información suficiente para recomendar bien';

    const decisionStarted = Date.now();
    const { next } = await this.decisions.decide(
      {
        objetivo: `Entrevista de sí o no, estilo Akinator, para recomendar ${domain.itemNounPlural} según el ánimo de la persona.`,
        respuestas: history,
        atributosConInformacion: config.attributes.filter((a) => informed.has(a.key)).map((a) => a.label),
        atributosSinInformacion: config.attributes.filter((a) => !informed.has(a.key)).map((a) => a.label),
        confianzaDelPerfil: profileConfidence(turns, config, known),
        ...stateExtras(session, config),
      },
      {
        next: {
          type: 'choice',
          instructions:
            'Elige la siguiente pregunta que más información nueva aporta teniendo en cuenta lo ya respondido. ' +
            'No elijas preguntas cuya respuesta ya se deduce de las anteriores.',
          criteria,
        },
      },
    ).catch((error: Error) => {
      // Sin ningún proveedor disponible, mejor la siguiente pregunta útil que una entrevista parada.
      this.logger.warn(`Siguiente pregunta sin IA: ${error.message.slice(0, 120)}`);
      const done = answered(turns).length >= config.interview.minQuestions && canFinishEarly(turns, config, known);
      return { next: { choice: done ? FINISH : options[0].id } };
    });
    const decisionMs = Date.now() - decisionStarted;
    if (next.choice === FINISH) {
      this.logger.log(`terminar (decisión ${decisionMs} ms)`);
      return turns;
    }

    const probe = options.find((p) => p.id === next.choice) ?? options[0];
    assertNotAsked(turns, probe.id);

    // La pregunta sale siempre del banco revisado; con algo pedido, el motivo lleva un ejemplo real.
    const focusDim = focused.length ? probe.informs.find((d) => focusDims.includes(d)) : undefined;
    const { question, reason } = this.questionText(domain, probe, turns, session.anchors ?? [], focus, focusDim);
    this.logger.log(`siguiente: ${probe.id} (decisión ${decisionMs} ms, banco)`);
    return [...turns, { probeId: probe.id, text: question, reason, answer: null, lead: this.leadLine(turns, session, domain) }];
  }

  /**
   * Texto de la pregunta: del banco revisado a mano (`question-texts.ts`), nunca redactado en
   * directo. Con algo pedido ("Marvel"), el motivo pone un ejemplo real del catálogo que sería un "sí".
   */
  private questionText(domain: DomainRow, probe: Probe, turns: InterviewTurn[], anchors: Anchor[], focus: AnchorFocus | null, dimension: string | undefined) {
    const picked = this.bank.pick(domain, probe.id, turns);
    const question = picked?.question ?? `¿${probe.yesChip.charAt(0).toUpperCase()}${probe.yesChip.slice(1)}?`;
    const example = focus && dimension ? anchorExample(focus.matched, dimension, probeDirection(probe, dimension, domain.config)) : null;
    const labels = anchors.filter((a) => a.kind !== 'title').map((a) => a.label).join(' o ');
    const reason = example && labels ? `Dentro de ${labels}, «${example.title}» sería un sí.` : (picked?.reason ?? '');
    return { question, reason };
  }

  /** Elementos de la bolsa de una sesión: de memoria si ya se cargaron, si no de la base de datos. */
  private bagItems(session: SessionSeed & { id?: string }, domain: DomainRow, bag: BagEntry[], loaded?: Map<string, ItemWithoutEmbedding>) {
    if (loaded) return Promise.resolve(loaded);
    const key = session.id ?? '';
    const cached = key ? this.bagCache.get(key) : undefined;
    if (cached) return cached;
    const task = this.items.byIds(domain.id, bag.map((e) => e.id), session.userId).then((rows) => new Map(rows.map((r) => [r.id, r])));
    if (key) {
      if (this.bagCache.size >= BAG_CACHE) this.bagCache.delete(this.bagCache.keys().next().value!);
      task.catch(() => this.bagCache.delete(key));
      this.bagCache.set(key, task);
    }
    return task;
  }

  /**
   * Siguiente pregunta de una entrevista guiada por candidatas: por cada sonda posible se
   * estima cuánto reduce la entropía de la bolsa (ganancia de información) y a la IA solo
   * se le ofrecen las 3 mejores. Lo que el texto ya dejó claro y lo que no quiere no se pregunta.
   * Termina cuando la bolsa está concentrada, con el mínimo y el máximo de preguntas.
   */
  private async advanceGuided(
    turns: InterviewTurn[],
    domain: DomainRow,
    session: SessionSeed & { id?: string },
    bag: BagEntry[],
    loaded?: Map<string, ItemWithoutEmbedding>,
  ): Promise<InterviewTurn[]> {
    const { config } = domain;
    const items = await this.bagItems(session, domain, bag, loaded);
    const known = Object.keys(session.textSignals ?? {});
    const plan = planNext({ turns, config, bag, items, known, exclusions: session.exclusions ?? [], facts: this.facts(session, domain) });
    if (plan.finish) {
      this.logger.log(`terminar: ${plan.finish} (~${Math.round(plan.left)} candidatas)`);
      return turns;
    }
    const { offered } = plan;
    const ignore = new Set(known);
    const left = Math.round(plan.left);
    const history = answered(turns).map((t) => ({ pregunta: t.text, respuesta: ANSWER_TEXT[t.answer!] }));

    const decisionStarted = Date.now();
    let chosen = offered[0];
    if (offered.length > 1) {
      const informed = informedDimensions(turns, config, known);
      const { next } = await this.decisions
        .decide(
          {
            objetivo: `Entrevista de sí o no, estilo Akinator, para recomendar ${domain.itemNounPlural} según el ánimo de la persona.`,
            respuestas: history,
            atributosSinInformacion: config.attributes.filter((a) => !informed.has(a.key)).map((a) => a.label),
            candidatasQueQuedan: left,
            gananciaDeInformacionPorPregunta: Object.fromEntries(offered.map((o) => [o.probe.id, Math.round(o.gain * 100) / 100])),
            ...stateExtras(session, config),
          },
          {
            next: {
              type: 'choice',
              instructions:
                'Elige la pregunta que mejor separa a las candidatas que quedan, teniendo en cuenta lo ya respondido. ' +
                'No elijas preguntas cuya respuesta ya se deduce de las anteriores.',
              criteria: Object.fromEntries(offered.map((o) => [o.probe.id, `Preguntar ${o.probe.intent.toLowerCase()}`])),
            },
          },
        )
        .catch((error: Error) => {
          this.logger.warn(`Siguiente pregunta sin IA: ${error.message.slice(0, 120)}`);
          return { next: { choice: offered[0].probe.id } };
        });
      chosen = offered.find((o) => o.probe.id === next.choice) ?? offered[0];
    }
    const decisionMs = Date.now() - decisionStarted;
    const { probe } = chosen;
    assertNotAsked(turns, probe.id);
    const meta = { gain: Math.round(chosen.gain * 100) / 100, left };

    const focus = session.anchors?.length ? await this.anchorFocus(session, domain) : null;
    const dimension = focus ? probe.informs.find((d) => focus.dimensions.includes(d) && !ignore.has(d)) : undefined;
    const { question, reason } = this.questionText(domain, probe, turns, session.anchors ?? [], focus, dimension);
    this.logger.log(`siguiente: ${probe.id} (${meta.gain} bits, quedan ~${left}, decisión ${decisionMs} ms, banco)`);
    return [...turns, { probeId: probe.id, text: question, reason, answer: null, lead: this.leadLine(turns, session, domain), ...meta }];
  }

  /** Una línea de contexto por plantilla ("Vale: Marvel · para desconectar · sin terror."), sin gastar IA. */
  private leadLine(turns: InterviewTurn[], session: SessionSeed, domain: DomainRow): string {
    const { config } = domain;
    const parts = [
      ...(session.anchors ?? []).map((a) => a.label),
      ...this.filterLabels(session.preferences, config),
      ...signalChips(session.textSignals ?? {}, config),
      ...config.tagGroups.filter((g) => session.exclusions?.includes(g.key)).map((g) => `sin ${g.label}`),
      ...answerChips(turns, config),
    ].slice(0, 4);
    if (!parts.length) return '';
    return answered(turns).length ? `Sigo con ${parts.join(' · ')}` : `Vale: ${parts.join(' · ')}.`;
  }

  /** Filtros previos activos en palabras ("Nintendo"); "me da igual" no cuenta. */
  private filterLabels(preferences: SessionSeed['preferences'], config: DomainRow['config']): string[] {
    return (config.preferences ?? []).flatMap((p) => {
      const value = preferences?.[p.key]?.value;
      return value && value !== p.anyValue ? [p.options.find((o) => o.value === value)?.label ?? value] : [];
    });
  }

  /** Elementos del ancla en el catálogo y lo que más los separa; sin anclas (o si falla), nada. */
  private async anchorFocus(session: SessionSeed, domain: DomainRow): Promise<AnchorFocus | null> {
    if (!session.anchors?.length) return null;
    const focus = await this.anchors.focus(domain, session.anchors, session.userId).catch(() => null);
    return focus && focus.matched.length >= 3 ? focus : null;
  }

  /**
   * Guarda solo si nadie ha cambiado la sesión desde que se leyó. Evita que una
   * petición lenta (doble toque, reintento) pise una respuesta más reciente y
   * devuelva una pregunta ya contestada.
   */
  private async save(row: SessionRow, patch: Partial<SessionRow>): Promise<SessionRow> {
    const [saved] = await this.db
      .update(interviewSessions)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(interviewSessions.id, row.id), sql`${interviewSessions.turns} = ${JSON.stringify(row.turns)}::jsonb`))
      .returning();
    if (!saved) throw new ConflictException('La entrevista ha cambiado mientras tanto; vuelve a cargarla');
    return saved;
  }

  async view(row: SessionRow, domain: DomainRow): Promise<SessionView> {
    const { config } = domain;
    const current = pending(row.turns);
    const probe = current && config.probes.find((p) => p.id === current.probeId);
    const known = Object.keys(row.textSignals ?? {});
    let candidates: SessionView['candidates'] = null;
    if (row.bag?.length) {
      const bag = row.bag;
      const items = await this.bagItems(row, domain, bag).catch(() => null);
      if (items) candidates = { left: Math.max(1, Math.round(effectiveCount(currentWeights(bag, items, row.turns, config, new Set(known))))), total: bag.length };
    }
    return {
      id: row.id,
      domainId: row.domainId,
      status: row.status,
      step: answered(row.turns).length + (current ? 1 : 0),
      minQuestions: minQuestions(config, known),
      maxQuestions: config.interview.maxQuestions,
      confidence: profileConfidence(row.turns, config, known),
      chips: [...signalChips(row.textSignals ?? {}, config), ...answerChips(row.turns, config)],
      question: current
        ? {
            text: current.text,
            lead: current.lead ?? '',
            reason: current.reason,
            guess: `¿${probe?.yesChip ?? ''}?`,
            chips: { yes: probe?.yesChip ?? '', no: probe?.noChip ?? '' },
          }
        : null,
      canUndo: answered(row.turns).length > 0,
      decisionProvider: this.decisions.name,
      context: row.context,
      fromText: signalChips(row.textSignals ?? {}, config),
      taste: (row.taste?.likes ?? []).map((l) => tasteLabel(l, config)),
      anchors: (row.anchors ?? []).map((a) => a.label),
      filters: this.filterLabels(row.preferences, config),
      excluded: config.tagGroups.filter((g) => row.exclusions?.includes(g.key)).map((g) => g.label),
      candidates,
    };
  }
}
