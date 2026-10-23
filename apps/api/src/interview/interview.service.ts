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
import { TEXT_PROVIDER, type TextProvider } from '../ai/text-provider.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions, type SessionRow } from '../db/schema.js';
import { DomainsService, type DomainRow } from '../domains/domains.service.js';
import { config as env } from '../config.js';
import { domainDefinitions } from '../domains/index.js';
import { hasTaste, tasteLabel, tasteOnlyProbes } from '../taste/taste.engine.js';
import { TasteService } from '../taste/taste.service.js';
import { collectContext, contextKey, stateExtras, type ContextRequest, type InterviewContext } from './interview.context.js';
import {
  answerChips,
  answered,
  canFinishEarly,
  informedDimensions,
  minQuestions,
  mustFinish,
  pending,
  profileConfidence,
  signalChips,
} from './interview.engine.js';
import { askableProbes, assertNotAsked, type InterviewFacts } from './interview.flow.js';
import { NextQuestionPrefetch } from './interview.prefetch.js';
import { QuestionBankService } from './question-bank.service.js';
import type { Answer, InterviewTurn, TextSignals } from './interview.types.js';

const ANSWER_TEXT: Record<Answer, string> = { yes: 'sí', no: 'no', unknown: 'no lo sé' };
const FINISH = 'finish';
const FIRST_QUESTION_TTL_MS = 30 * 60_000;
/** Confianza mínima para dar por resuelta una dimensión a partir del texto inicial. */
const SIGNAL_CONFIDENCE = 0.75;
const contextDefaults = () => ({ timeZone: env.contextTimeZone, latitude: env.contextLatitude, longitude: env.contextLongitude });

const questionSchema = z.object({
  question: z.string().describe('Pregunta de sí o no, de 3 a 9 palabras, hablando de tú, sin negaciones'),
  reason: z.string().describe('Una frase corta que explica por qué preguntas esto ahora'),
});

type SessionSeed = Pick<SessionRow, 'context' | 'initialText' | 'taste' | 'textSignals'>;

export interface StartOptions {
  /** Punto de partida opcional (texto o voz transcrita). Se trata como dato, nunca como instrucción. */
  initialText?: string;
  /** Persona anónima, para usar sus gustos. */
  userId?: string | null;
  /** Zona horaria y posición aproximada que manda el navegador. */
  client?: ContextRequest;
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
  question: { text: string; reason: string; guess: string; chips: { yes: string; no: string } } | null;
  canUndo: boolean;
  decisionProvider: string;
  /** Hora, día y tiempo con los que se adapta la entrevista. */
  context: InterviewContext;
  /** Lo que ya dejó claro el texto inicial ("tranquilo"): no se pregunta. */
  fromText: string[];
  /** Gustos de largo plazo que se están teniendo en cuenta. */
  taste: string[];
}

@Injectable()
export class InterviewService implements OnModuleInit {
  private readonly logger = new Logger('Entrevista');
  private readonly prefetch = new NextQuestionPrefetch();
  /** La primera pregunta no depende de nada (sin texto inicial ni contexto): se prepara una vez por dominio. */
  private readonly firstQuestion = new Map<string, { turns: Promise<InterviewTurn[]>; at: number }>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(INTERVIEW_DECISION_PROVIDER) private readonly decisions: DecisionProvider,
    @Inject(TEXT_PROVIDER) private readonly text: TextProvider,
    private readonly domains: DomainsService,
    private readonly bank: QuestionBankService,
    private readonly tastes: TasteService,
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

  async start(domainId: string, { initialText, userId = null, client = {} }: StartOptions = {}): Promise<SessionView> {
    const domain = await this.domains.get(domainId);
    const text = initialText?.trim() || null;
    const [context, taste, textSignals] = await Promise.all([
      collectContext(client, contextDefaults()),
      this.tastes.profile(userId, domainId),
      text ? this.readSignals(domain, text) : ({} as TextSignals),
    ]);
    const seed: SessionSeed = { context, initialText: text, taste: hasTaste(taste) ? taste : null, textSignals };
    // Sin texto ni gustos, la primera pregunta solo depende del contexto: se reutiliza.
    const generic = !seed.initialText && !seed.taste;
    const turns = generic ? await this.firstTurns(domain, context) : await this.advance([], domain, seed);
    const [row] = await this.db.insert(interviewSessions).values({ domainId, turns, userId, ...seed }).returning();
    this.schedulePrefetch(row, domain);
    return this.view(row, domain);
  }

  async get(id: string): Promise<SessionView> {
    const row = await this.load(id);
    return this.view(row, await this.domains.get(row.domainId));
  }

  /**
   * Responde la pregunta pendiente. `step` (el número de pregunta que ve el cliente)
   * protege contra dobles envíos: si ya no coincide, la respuesta llegó tarde.
   */
  async answer(id: string, answer: Answer, step?: number): Promise<SessionView> {
    const row = await this.load(id);
    const domain = await this.domains.get(row.domainId);
    const current = pending(row.turns);
    if (row.status !== 'asking' || !current) throw new ConflictException('Esta entrevista no tiene una pregunta pendiente');
    const answeredCount = answered(row.turns).length;
    if (step !== undefined && step !== answeredCount + 1) {
      throw new ConflictException('Esa respuesta es de una pregunta anterior');
    }

    const base = row.turns.map((t) => (t === current ? { ...t, answer } : t));
    const started = Date.now();
    const prefetched = this.prefetch.take(row.id, answeredCount, answer);
    const turns = prefetched
      ? await prefetched.catch(() => this.advance(base, domain, row))
      : await this.advance(base, domain, row);
    this.logger.log(`Respuesta ${answeredCount + 1} → siguiente en ${Date.now() - started} ms${prefetched ? ' (precargada)' : ''}`);

    const status = pending(turns) ? 'asking' : 'ready';
    const saved = await this.save(row, { turns, status });
    if (status === 'asking') this.schedulePrefetch(saved, domain);
    return this.view(saved, domain);
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
    const turns = this.advance([], domain, { context, initialText: null, taste: null, textSignals: {} });
    turns.catch(() => this.firstQuestion.delete(key));
    this.firstQuestion.set(key, { turns, at: Date.now() });
    return turns;
  }

  /**
   * Lo que el texto inicial ya deja claro, una decisión `choice` por atributo de escala
   * (con la cadena rápida de la entrevista). Solo se quedan las señales confiadas; si falla,
   * la entrevista pregunta por todo, como sin texto.
   */
  private async readSignals(domain: DomainRow, text: string): Promise<TextSignals> {
    const scales = domain.config.attributes.filter((a) => a.kind === 'scale');
    const answers = await this.decisions
      .decide(
        { textoDeLaPersona: text.slice(0, 500) },
        Object.fromEntries(
          scales.map((a) => [
            a.key,
            {
              type: 'choice' as const,
              instructions: `Según el texto, ¿qué ${a.label.toLowerCase()} (${a.description.toLowerCase()}) le apetece para ${domain.config.verb} ahora? Si el texto no lo dice claramente, elige "unknown".`,
              criteria: { low: a.lowLabel ?? 'Bajo', high: a.highLabel ?? 'Alto', unknown: 'El texto no lo dice' },
            },
          ]),
        ),
      )
      .catch((error: Error) => {
        this.logger.warn(`Sin señales del texto inicial: ${error.message.slice(0, 120)}`);
        return null;
      });
    if (!answers) return {};
    const signals: TextSignals = {};
    for (const a of scales) {
      const answer = answers[a.key];
      const confidence = answer?.confidence ?? 0.7;
      if (!answer || answer.choice === 'unknown' || confidence < SIGNAL_CONFIDENCE) continue;
      signals[a.key] = { value: answer.choice === 'high' ? 0.85 : 0.15, confidence: Math.round(confidence * 100) / 100 };
    }
    this.logger.log(`Texto inicial → ${Object.keys(signals).join(', ') || 'nada claro'}`);
    return signals;
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
  private async advance(turns: InterviewTurn[], domain: DomainRow, session: SessionSeed): Promise<InterviewTurn[]> {
    const { config } = domain;
    const facts = this.facts(session, domain);
    const known = facts.known ?? [];
    if (answered(turns).length && mustFinish(turns, config, known)) return turns;

    const options = askableProbes(turns, config, facts);
    if (!options.length) return turns;
    const informed = informedDimensions(turns, config, known);
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
    );
    const decisionMs = Date.now() - decisionStarted;
    if (next.choice === FINISH) {
      this.logger.log(`terminar (decisión ${decisionMs} ms)`);
      return turns;
    }

    const probe = options.find((p) => p.id === next.choice) ?? options[0];
    assertNotAsked(turns, probe.id);

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

  view(row: SessionRow, domain: DomainRow): SessionView {
    const { config } = domain;
    const current = pending(row.turns);
    const probe = current && config.probes.find((p) => p.id === current.probeId);
    const known = Object.keys(row.textSignals ?? {});
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
    };
  }
}
