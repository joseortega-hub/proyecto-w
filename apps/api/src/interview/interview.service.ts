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
import { domainDefinitions } from '../domains/music.domain.js';
import { collectContext, stateExtras, type InterviewContext } from './interview.context.js';
import {
  answerChips,
  answered,
  canFinishEarly,
  informedDimensions,
  mustFinish,
  pending,
  profileConfidence,
} from './interview.engine.js';
import { askableProbes, assertNotAsked } from './interview.flow.js';
import { NextQuestionPrefetch } from './interview.prefetch.js';
import { QuestionBankService } from './question-bank.service.js';
import type { Answer, InterviewTurn } from './interview.types.js';

const ANSWER_TEXT: Record<Answer, string> = { yes: 'sí', no: 'no', unknown: 'no lo sé' };
const FINISH = 'finish';
const FIRST_QUESTION_TTL_MS = 30 * 60_000;

const questionSchema = z.object({
  question: z.string().describe('Pregunta de sí o no, de 3 a 9 palabras, hablando de tú, sin negaciones'),
  reason: z.string().describe('Una frase corta que explica por qué preguntas esto ahora'),
});

type SessionSeed = Pick<SessionRow, 'context' | 'initialText'>;

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
  ) {}

  /** Carga el banco de preguntas y calienta la primera pregunta al arrancar, sin bloquear el arranque. */
  onModuleInit() {
    for (const d of domainDefinitions) {
      this.domains
        .get(d.id)
        .then(async (domain) => {
          await this.bank.load(domain);
          return this.firstTurns(domain);
        })
        .catch((error: Error) => this.logger.warn(`No he podido preparar la primera pregunta de ${d.id}: ${error.message}`));
    }
  }

  async start(domainId: string, initialText?: string): Promise<SessionView> {
    const domain = await this.domains.get(domainId);
    const seed: SessionSeed = { context: await collectContext(), initialText: initialText?.trim() || null };
    const generic = !seed.initialText && Object.keys(seed.context).length === 0;
    const turns = generic ? await this.firstTurns(domain) : await this.advance([], domain, seed);
    const [row] = await this.db.insert(interviewSessions).values({ domainId, turns, ...seed }).returning();
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

  private firstTurns(domain: DomainRow): Promise<InterviewTurn[]> {
    const cached = this.firstQuestion.get(domain.id);
    if (cached && Date.now() - cached.at < FIRST_QUESTION_TTL_MS) return cached.turns;
    const turns = this.advance([], domain, { context: {} as InterviewContext, initialText: null });
    turns.catch(() => this.firstQuestion.delete(domain.id));
    this.firstQuestion.set(domain.id, { turns, at: Date.now() });
    return turns;
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
    if (answered(turns).length && mustFinish(turns, config)) return turns;

    const options = askableProbes(turns, config);
    if (!options.length) return turns;
    const informed = informedDimensions(turns, config);
    const history = answered(turns).map((t) => ({ pregunta: t.text, respuesta: ANSWER_TEXT[t.answer!] }));

    const criteria: Record<string, string> = Object.fromEntries(options.map((p) => [p.id, `Preguntar ${p.intent.toLowerCase()}`]));
    if (canFinishEarly(turns, config)) criteria[FINISH] = 'Terminar: ya hay información suficiente para recomendar bien';

    const decisionStarted = Date.now();
    const { next } = await this.decisions.decide(
      {
        objetivo: `Entrevista de sí o no, estilo Akinator, para recomendar ${domain.itemNounPlural} según el ánimo de la persona.`,
        respuestas: history,
        atributosConInformacion: config.attributes.filter((a) => informed.has(a.key)).map((a) => a.label),
        atributosSinInformacion: config.attributes.filter((a) => !informed.has(a.key)).map((a) => a.label),
        confianzaDelPerfil: profileConfidence(turns, config),
        ...stateExtras(session),
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
        system: `${config.voice} Redactas preguntas para una entrevista de sí o no sobre lo que le apetece escuchar ahora.`,
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
    return {
      id: row.id,
      domainId: row.domainId,
      status: row.status,
      step: answered(row.turns).length + (current ? 1 : 0),
      minQuestions: config.interview.minQuestions,
      maxQuestions: config.interview.maxQuestions,
      confidence: profileConfidence(row.turns, config),
      chips: answerChips(row.turns, config),
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
    };
  }
}
