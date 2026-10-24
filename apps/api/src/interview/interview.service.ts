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
import { hasTaste, tasteLabel, tasteOnlyProbes } from '../taste/taste.engine.js';
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
  remainingProbes,
  signalChips,
} from './interview.engine.js';
import { buildBag, effectiveCount, currentWeights, planNext } from './candidates.js';
import { anchorsDone, askableProbes, assertNotAsked, autoAnswerExhausted, type InterviewFacts } from './interview.flow.js';
import { NextQuestionPrefetch } from './interview.prefetch.js';
import { anchorExample, anchorQueryText, cleanAnchors, probeDirection } from './anchors.js';
import { AnchorsService, START_COVERAGE_WAIT_MS, type AnchorFocus } from './anchors.service.js';
import { QuestionBankService } from './question-bank.service.js';
import type { Anchor, Answer, BagEntry, EditedUnderstanding, InterviewTurn, Understanding } from './interview.types.js';
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

const questionSchema = z.object({
  question: z.string().describe('Pregunta de sí o no, de 3 a 9 palabras, hablando de tú, sin negaciones'),
  reason: z.string().describe('Una frase corta que explica por qué preguntas esto ahora'),
});

type SessionSeed = Pick<SessionRow, 'context' | 'initialText' | 'taste' | 'textSignals' | 'anchors' | 'userId' | 'exclusions' | 'bag' | 'preferences'>;

export interface StartOptions {
  /** Punto de partida opcional (texto o voz transcrita). Se trata como dato, nunca como instrucción. */
  initialText?: string;
  /** Persona anónima, para usar sus gustos. */
  userId?: string | null;
  /** Zona horaria y posición aproximada que manda el navegador. */
  client?: ContextRequest;
  /** Preferencias elegidas con los botones (idioma, plataforma…): ganan a las deducidas del texto. */
  preferences?: Record<string, string>;
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
  async understand(domainId: string, text: string, userId: string | null = null): Promise<Understanding> {
    const domain = await this.domains.get(domainId);
    const understood = await this.understanding.understand(domain, text.trim());
    if (understood.anchors.length) void this.anchors.ensureCoverage(domain, understood.anchors, userId);
    return understood;
  }

  async start(domainId: string, { initialText, userId = null, client = {}, preferences: chosen = {}, understanding: edited }: StartOptions = {}): Promise<SessionView> {
    const domain = await this.domains.get(domainId);
    const { config } = domain;
    const text = initialText?.trim() || null;
    const [context, taste, understood] = await Promise.all([
      collectContext(client, contextDefaults()),
      this.tastes.profile(userId, domainId),
      edited ? Promise.resolve(this.fromEdited(edited, domain)) : text ? this.understanding.understand(domain, text) : emptyUnderstanding(),
    ]);
    const { anchors, exclusions } = understood;
    // Si el catálogo se queda corto para lo que pidió, se busca en directo; la primera pregunta
    // la espera un poco para enfocarse ya en lo encontrado (si tarda más, sigue en segundo plano).
    if (anchors.length) await this.anchors.awaitCoverage(domain, anchors, userId, START_COVERAGE_WAIT_MS);
    const preferences = this.prefs.merge(domain, chosen, understood.preferences);
    const filters = preferenceFilters(preferences, config);
    const textSignals = signalsOf(understood);
    const seed: SessionSeed = {
      context,
      initialText: text,
      taste: hasTaste(taste) ? taste : null,
      textSignals,
      anchors,
      userId,
      exclusions,
      preferences,
      bag: null,
    };
    // Con texto, filtros o exclusiones, la entrevista se guía por una bolsa de candidatas.
    let loaded: Map<string, ItemWithoutEmbedding> | undefined;
    if (text || filters.length || exclusions.length || anchors.length) {
      const catalog = await this.items.catalog(domainId, filters, userId);
      const semantic = text ? await this.semanticMap(domain, text, anchors, filters, userId) : undefined;
      const bag = buildBag(catalog, { config, signals: textSignals, anchors, exclusions, filters, taste: seed.taste, semantic });
      this.logger.log(`Bolsa: ${bag.entries.length} de ${catalog.length} (anclas: ${bag.mode}, ${bag.matched} coinciden)`);
      if (bag.entries.length) {
        seed.bag = bag.entries;
        const byId = new Map(catalog.map((it) => [it.id, it]));
        loaded = new Map(bag.entries.map((e) => [e.id, byId.get(e.id)!]));
      }
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
    const turns = row.turns.filter((t) => t.answer !== null).map((t) => (t === last ? { ...t, answer: null } : t));
    this.prefetch.forget(row.id);
    const domain = await this.domains.get(row.domainId);
    const saved = await this.save(row, { turns, status: 'asking', profile: null, result: null });
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
    const turns = this.advance([], domain, { context, initialText: null, taste: null, textSignals: {}, anchors: [], userId: null, exclusions: [], bag: null, preferences: {} });
    turns.catch(() => this.firstQuestion.delete(key));
    this.firstQuestion.set(key, { turns, at: Date.now() });
    return turns;
  }

  /** Lo que ya se sabe antes de preguntar: dimensiones del texto y sondas de gustos que sobran. */
  private facts(session: SessionSeed, domain: DomainRow): InterviewFacts {
    return {
      known: Object.keys(session.textSignals ?? {}),
      skip: session.taste ? tasteOnlyProbes(domain.config) : undefined,
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

    // Con anclas, la pregunta siempre se redacta con ellas: el banco genérico habla de otras
    // cosas ("¿algo tipo Mario Kart?") y despista.
    const focusDim = focused.length ? probe.informs.find((d) => focusDims.includes(d)) : undefined;
    if (session.anchors?.length) {
      const written = await this.writeAnchored(domain, session.anchors, focus, probe, focusDim, history);
      if (written) {
        this.logger.log(`siguiente: ${probe.id} (decisión ${decisionMs} ms, enfocada en ${session.anchors.map((a) => a.label).join(', ')})`);
        return [...turns, { probeId: probe.id, text: written.question, reason: written.reason, answer: null }];
      }
      // Sin texto, la pregunta saldría del banco genérico y no hablaría de lo que pidió.
      if (anchorsDone(session.anchors.length, focus !== null, focused.length, answered(turns).length, 'unwritten')) {
        this.logger.log('terminar: sin redacción para una pregunta enfocada, saco la lista con lo que hay');
        return turns;
      }
    }

    const fromBank = this.bank.pick(domain, probe.id, turns);
    if (fromBank) {
      this.logger.log(`siguiente: ${probe.id} (decisión ${decisionMs} ms, banco)`);
      return [...turns, { probeId: probe.id, text: fromBank.question, reason: fromBank.reason, answer: null }];
    }

    const writeStarted = Date.now();
    const written = await this.text
      .write({
        system: `${config.voice} Redactas preguntas para una entrevista de sí o no sobre lo que le apetece ${config.verb} ahora.`,
        prompt: [
          `Qué quieres averiguar: ${probe.intent}.`,
          history.length
            ? `Preguntas ya hechas (no repitas su idea ni sus palabras clave):\n${history.map((h) => `- ${h.pregunta} → ${h.respuesta}`).join('\n')}`
            : 'Es la primera pregunta.',
          `Escribe la pregunta en positivo, de forma que «sí» signifique exactamente esto: ${probe.intent.toLowerCase()}. ` +
            'Sin negaciones («no», «sin»). Añade una frase corta con el motivo; si una respuesta anterior es la razón, menciónala.',
        ].join('\n\n'),
        schema: questionSchema,
      })
      .catch((error: Error) => {
        // Si no hay texto, mejor una pregunta sencilla que una entrevista parada.
        this.logger.warn(`Sin redacción para "${probe.id}": ${error.message}`);
        return { question: `¿${probe.intent.replace(/^Si /, '')}?`, reason: '' };
      });
    this.logger.log(
      `siguiente: ${probe.id} (decisión ${decisionMs} ms, redacción en vivo ${Date.now() - writeStarted} ms)`,
    );

    return [...turns, { probeId: probe.id, text: written.question, reason: written.reason, answer: null }];
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

    // Con anclas, la pregunta se redacta con ellas y un ejemplo real ("¿…tipo Guardianes de la Galaxia?").
    if (session.anchors?.length) {
      const focus = await this.anchorFocus(session, domain);
      const dimension = focus ? probe.informs.find((d) => focus.dimensions.includes(d) && !ignore.has(d)) : undefined;
      const written = await this.writeAnchored(domain, session.anchors, focus, probe, dimension, history);
      if (written) {
        this.logger.log(`siguiente: ${probe.id} (${meta.gain} bits, quedan ~${left}, decisión ${decisionMs} ms, enfocada)`);
        return [...turns, { probeId: probe.id, text: written.question, reason: written.reason, answer: null, ...meta }];
      }
    }
    const lead = this.leadLine(turns, session, domain);
    const fromBank = this.bank.pick(domain, probe.id, turns);
    if (fromBank) {
      this.logger.log(`siguiente: ${probe.id} (${meta.gain} bits, quedan ~${left}, decisión ${decisionMs} ms, banco)`);
      return [...turns, { probeId: probe.id, text: fromBank.question, reason: fromBank.reason, answer: null, lead, ...meta }];
    }
    const written = await this.text
      .write({
        system: `${config.voice} Redactas preguntas para una entrevista de sí o no sobre lo que le apetece ${config.verb} ahora.`,
        prompt: [
          `Qué quieres averiguar: ${probe.intent}.`,
          history.length ? `Preguntas ya hechas (no repitas su idea ni sus palabras clave):\n${history.map((h) => `- ${h.pregunta} → ${h.respuesta}`).join('\n')}` : 'Es la primera pregunta.',
          `Escribe la pregunta en positivo, de forma que «sí» signifique exactamente esto: ${probe.intent.toLowerCase()}. Sin negaciones («no», «sin»). Añade una frase corta con el motivo.`,
        ].join('\n\n'),
        schema: questionSchema,
      })
      .catch((error: Error) => {
        this.logger.warn(`Sin redacción para "${probe.id}": ${error.message}`);
        return { question: `¿${probe.intent.replace(/^Si /, '')}?`, reason: '' };
      });
    return [...turns, { probeId: probe.id, text: written.question, reason: written.reason, answer: null, lead, ...meta }];
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
   * Pregunta redactada en vivo con el ancla y un ejemplo real del catálogo ("¿Te apetece una
   * de Marvel con mucho humor, tipo Guardianes de la Galaxia?"). Si no hay texto, null.
   */
  private async writeAnchored(
    domain: DomainRow,
    anchors: Anchor[],
    focus: AnchorFocus | null,
    probe: Probe,
    dimension: string | undefined,
    history: { pregunta: string; respuesta: string }[],
  ) {
    const { config } = domain;
    const labels = anchors.map((a) => a.label).join(' o ');
    const example = focus && dimension ? anchorExample(focus.matched, dimension, probeDirection(probe, dimension, config)) : null;
    return this.text
      .write({
        system: `${config.voice} Redactas preguntas para una entrevista de sí o no sobre lo que le apetece ${config.verb} ahora.`,
        prompt: [
          dimension
            ? `La persona ha pedido ${domain.itemNounPlural} de ${labels}. Entre ellas, lo que más cambia de una a otra es esto, y es lo que quieres averiguar: ${probe.intent}.`
            : `La persona ha pedido ${domain.itemNounPlural} de ${labels}. Quieres averiguar qué tipo de ${labels} le apetece: ${probe.intent}.`,
          history.length
            ? `Preguntas ya hechas (no repitas su idea):\n${history.map((h) => `- ${h.pregunta} → ${h.respuesta}`).join('\n')}`
            : 'Es la primera pregunta.',
          `Escribe la pregunta en positivo, de forma que «sí» signifique exactamente esto: ${probe.intent.toLowerCase()}. Menciona ${labels}` +
            (example ? ` y pon como ejemplo «${example.title}» (con "tipo" o "como").` : '.') +
            ` No menciones otras sagas, títulos ni marcas. Sin negaciones ni formato (nada de asteriscos). La pregunta termina en el signo de interrogación, sin frases detrás. ` +
            `Añade un motivo corto dirigido a la persona (hablándole de tú), sin hablar de filtros, opciones ni de lo que «las distingue».`,
        ].join('\n\n'),
        schema: questionSchema,
      })
      .then((w) => ({ question: tidyQuestion(w.question), reason: w.reason.replace(/[*_]/g, '').trim() }))
      .catch((error: Error) => {
        this.logger.warn(`Sin pregunta enfocada para "${probe.id}": ${error.message.slice(0, 120)}`);
        return null;
      });
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
