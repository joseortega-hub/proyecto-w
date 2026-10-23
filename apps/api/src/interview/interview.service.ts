import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { DECISION_PROVIDER, type DecisionProvider } from '../ai/decision-provider.js';
import { TEXT_PROVIDER, type TextProvider } from '../ai/text-provider.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { interviewSessions, type SessionRow } from '../db/schema.js';
import { DomainsService, type DomainRow } from '../domains/domains.service.js';
import {
  answerChips,
  answered,
  canFinishEarly,
  informedDimensions,
  mustFinish,
  pending,
  profileConfidence,
  remainingProbes,
} from './interview.engine.js';
import type { Answer, InterviewTurn } from './interview.types.js';

const ANSWER_TEXT: Record<Answer, string> = { yes: 'sí', no: 'no', unknown: 'no lo sé' };
const FINISH = 'finish';

const draftsSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string().describe('Pregunta de sí o no, de 3 a 9 palabras, hablando de tú, sin negaciones'),
      reason: z.string().describe('Una frase corta que explica por qué preguntarías esto ahora'),
    }),
  ),
});

export interface SessionView {
  id: string;
  domainId: string;
  status: SessionRow['status'];
  step: number;
  minQuestions: number;
  maxQuestions: number;
  confidence: number;
  chips: string[];
  question: { text: string; reason: string; guess: string } | null;
  canUndo: boolean;
  decisionProvider: string;
}

@Injectable()
export class InterviewService {
  private readonly logger = new Logger('Entrevista');

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(DECISION_PROVIDER) private readonly decisions: DecisionProvider,
    @Inject(TEXT_PROVIDER) private readonly text: TextProvider,
    private readonly domains: DomainsService,
  ) {}

  async start(domainId: string): Promise<SessionView> {
    const domain = await this.domains.get(domainId);
    const turns = await this.advance([], domain);
    const [row] = await this.db.insert(interviewSessions).values({ domainId, turns }).returning();
    return this.view(row, domain);
  }

  async get(id: string): Promise<SessionView> {
    const row = await this.load(id);
    return this.view(row, await this.domains.get(row.domainId));
  }

  async answer(id: string, answer: Answer): Promise<SessionView> {
    const row = await this.load(id);
    const current = pending(row.turns);
    if (row.status !== 'asking' || !current) throw new BadRequestException('Esta entrevista no tiene una pregunta pendiente');

    const domain = await this.domains.get(row.domainId);
    const turns = await this.advance(
      row.turns.map((t) => (t === current ? { ...t, answer } : t)),
      domain,
    );
    const status = pending(turns) ? 'asking' : 'ready';
    return this.save(row.id, { turns, status }, domain);
  }

  /** Deshace la última respuesta: esa pregunta vuelve a quedar pendiente. */
  async undo(id: string): Promise<SessionView> {
    const row = await this.load(id);
    const done = answered(row.turns);
    if (!done.length) throw new BadRequestException('No hay respuestas que deshacer');
    const last = done[done.length - 1];
    const turns = row.turns.filter((t) => t.answer !== null).map((t) => (t === last ? { ...t, answer: null } : t));
    return this.save(row.id, { turns, status: 'asking', profile: null, result: null }, await this.domains.get(row.domainId));
  }

  async load(id: string): Promise<SessionRow> {
    if (!z.uuid().safeParse(id).success) throw new NotFoundException('Entrevista no encontrada');
    const [row] = await this.db.select().from(interviewSessions).where(eq(interviewSessions.id, id));
    if (!row) throw new NotFoundException('Entrevista no encontrada');
    return row;
  }

  /**
   * Decide la siguiente pregunta (o terminar) y la redacta. La decisión la toma el
   * DecisionProvider (Jev o Gemini); el texto, el TextProvider (Gemini).
   */
  private async advance(turns: InterviewTurn[], domain: DomainRow): Promise<InterviewTurn[]> {
    const { config } = domain;
    if (answered(turns).length && mustFinish(turns, config)) return turns;

    const options = remainingProbes(turns, config);
    const informed = informedDimensions(turns, config);
    const history = answered(turns).map((t) => ({ pregunta: t.text, respuesta: ANSWER_TEXT[t.answer!] }));

    const criteria: Record<string, string> = Object.fromEntries(options.map((p) => [p.id, `Preguntar ${p.intent.toLowerCase()}`]));
    if (canFinishEarly(turns, config)) criteria[FINISH] = 'Terminar: ya hay información suficiente para recomendar bien';

    // La decisión y la redacción van en paralelo: mientras el DecisionProvider elige,
    // el TextProvider redacta todas las candidatas en una sola llamada. Así la espera
    // es la de una llamada, no la de dos seguidas.
    const started = Date.now();
    const [{ next }, drafts] = await Promise.all([
      this.decisions.decide(
        {
          objetivo: `Entrevista de sí o no, estilo Akinator, para recomendar ${domain.itemNounPlural} según el ánimo de la persona.`,
          respuestas: history,
          atributosConInformacion: config.attributes.filter((a) => informed.has(a.key)).map((a) => a.label),
          atributosSinInformacion: config.attributes.filter((a) => !informed.has(a.key)).map((a) => a.label),
          confianzaDelPerfil: profileConfidence(turns, config),
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
      ),
      this.text.write({
        system: `${config.voice} Redactas preguntas para una entrevista de sí o no sobre lo que le apetece escuchar ahora.`,
        prompt: [
          history.length
            ? `Respuestas hasta ahora:\n${history.map((h) => `- ${h.pregunta} → ${h.respuesta}`).join('\n')}`
            : 'Es la primera pregunta.',
          'Para cada posible siguiente pregunta, escribe la pregunta y una frase corta con el motivo:',
          ...options.map((p) => `- ${p.id}: ${p.intent}`),
          'Cada pregunta va en positivo, de forma que «sí» signifique exactamente lo indicado; sin negaciones («no», «sin»). ' +
            'Si una respuesta anterior es la razón de preguntar algo, menciónala en el motivo.',
        ].join('\n'),
        schema: draftsSchema,
      }),
    ]);
    this.logger.log(`[${this.decisions.name}] siguiente: ${next.choice} (${Date.now() - started} ms)`);
    if (next.choice === FINISH) return turns;

    const probe = options.find((p) => p.id === next.choice) ?? options[0];
    const written = drafts.questions.find((q) => q.id === probe.id) ?? {
      question: `¿${probe.intent.replace(/^Si /, '')}?`,
      reason: '',
    };

    return [...turns, { probeId: probe.id, text: written.question, reason: written.reason, answer: null }];
  }

  private async save(id: string, patch: Partial<SessionRow>, domain: DomainRow) {
    const [row] = await this.db
      .update(interviewSessions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(interviewSessions.id, id))
      .returning();
    return this.view(row, domain);
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
      question: current ? { text: current.text, reason: current.reason, guess: `¿${probe?.yesChip ?? ''}?` } : null,
      canUndo: answered(row.turns).length > 0,
      decisionProvider: this.decisions.name,
    };
  }
}
