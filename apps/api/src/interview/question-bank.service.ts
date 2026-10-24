import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { z } from 'zod';
import { TEXT_PROVIDER, type TextProvider } from '../ai/text-provider.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { questionBank } from '../db/question-bank.schema.js';
import type { DomainDefinition, Probe } from '../domains/domain.types.js';
import { pickVariant, type BankVariant } from './question-bank.js';
import { questionsFor } from './question-texts.js';
import type { InterviewTurn } from './interview.types.js';

const VARIANTS = 3;
/** Sondas por llamada: lotes pequeños para no rozar el timeout del plan gratuito. */
const PROBES_PER_CALL = 5;

const bankSchema = z.object({
  probes: z.array(
    z.object({
      id: z.string(),
      variants: z.array(
        z.object({
          question: z.string().describe('Pregunta de sí o no, de 3 a 9 palabras, hablando de tú, sin negaciones'),
          reason: z.string().describe('Frase corta que explica por qué se pregunta, sin aludir a respuestas anteriores'),
        }),
      ),
    }),
  ),
});

/** Siempre entre signos de interrogación: «¿…?». */
export const asQuestion = (q: string) => `¿${q.trim().replace(/^¿+/, '').replace(/\?+$/, '')}?`;

type DomainLike = Pick<DomainDefinition, 'id' | 'itemNounPlural'> & { config: Pick<DomainDefinition['config'], 'voice' | 'probes'> };

/**
 * Redacta con el TextProvider las variantes que faltan (o cuya sonda cambió) y las guarda.
 * Devuelve cuántas sondas se han redactado. Se usa al arrancar la API y en `pnpm questions`.
 */
export async function generateQuestionBank(
  db: Db,
  text: TextProvider,
  domain: DomainLike,
  log: (m: string) => void = () => undefined,
): Promise<number> {
  const rows = await db.select().from(questionBank).where(eq(questionBank.domainId, domain.id));
  // Las sondas con preguntas revisadas a mano (`question-texts.ts`) no se redactan con IA.
  let missing = domain.config.probes.filter(
    (p) => !questionsFor(domain.id, p.id).length && rows.filter((r) => r.probeId === p.id && r.intent === p.intent).length < VARIANTS,
  );
  // Una sonda idéntica (mismo id e intención) de otra temática ya tiene variantes revisadas:
  // se copian en vez de redactar otras (p. ej. "Mi YouTube" reutiliza las de música).
  if (missing.length) {
    const others = await db
      .select()
      .from(questionBank)
      .where(and(ne(questionBank.domainId, domain.id), inArray(questionBank.probeId, missing.map((p) => p.id))));
    const reused = missing.flatMap((p) => {
      const source = others.find((o) => o.probeId === p.id && o.intent === p.intent)?.domainId;
      const variants = others.filter((o) => o.domainId === source && o.probeId === p.id && o.intent === p.intent);
      return variants.length >= VARIANTS ? [{ probe: p, variants }] : [];
    });
    if (reused.length) {
      const ids = reused.map((r) => r.probe.id);
      await db.transaction(async (tx) => {
        await tx.delete(questionBank).where(and(eq(questionBank.domainId, domain.id), inArray(questionBank.probeId, ids)));
        await tx.insert(questionBank).values(
          reused.flatMap((r) =>
            r.variants.map(({ variant, intent, question, reason }) => ({ domainId: domain.id, probeId: r.probe.id, variant, intent, question, reason })),
          ),
        );
      });
      log(`${domain.id}: variantes reutilizadas de otra temática para ${ids.join(', ')}`);
      missing = missing.filter((p) => !ids.includes(p.id));
    }
  }
  for (let i = 0; i < missing.length; i += PROBES_PER_CALL) {
    const batch = missing.slice(i, i + PROBES_PER_CALL);
    const written = await text.write({
      system: `${domain.config.voice} Redactas preguntas para una entrevista de sí o no sobre lo que le apetece ahora.`,
      prompt: [
        `Para cada sonda, escribe ${VARIANTS} formas distintas de preguntarla, con vocabulario variado entre ellas.`,
        'Cada pregunta va en positivo, de forma que «sí» signifique exactamente lo indicado; sin negaciones («no», «sin»).',
        'Cada pregunta habla solo de su sonda: no mezcles conceptos de otras (por ejemplo, energía no es lo mismo que bailar).',
        'El motivo no debe aludir a respuestas anteriores: estas preguntas se reutilizan en cualquier momento de la entrevista.',
        ...batch.map((p) => `- ${p.id}: ${p.intent}`),
      ].join('\n'),
      schema: bankSchema,
    });
    const values = batch.flatMap((p: Probe) => {
      const variants = written.probes.find((w) => w.id === p.id)?.variants.slice(0, VARIANTS) ?? [];
      return variants.map((v, variant) => ({
        domainId: domain.id,
        probeId: p.id,
        variant,
        intent: p.intent,
        question: asQuestion(v.question),
        reason: v.reason.trim(),
      }));
    });
    const ids = batch.map((p) => p.id);
    await db.transaction(async (tx) => {
      await tx.delete(questionBank).where(and(eq(questionBank.domainId, domain.id), inArray(questionBank.probeId, ids)));
      if (values.length) await tx.insert(questionBank).values(values);
    });
    log(`${domain.id}: ${values.length} preguntas redactadas para ${ids.join(', ')}`);
  }
  return missing.length;
}

/**
 * Banco en memoria por dominio. La entrevista pide una variante de la sonda elegida;
 * si no hay (banco aún sin generar, sonda nueva), redacta en vivo como respaldo.
 */
@Injectable()
export class QuestionBankService {
  private readonly logger = new Logger('Banco de preguntas');
  private readonly cache = new Map<string, Map<string, BankVariant[]>>();
  private readonly loading = new Map<string, Promise<void>>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(TEXT_PROVIDER) private readonly text: TextProvider,
  ) {}

  /** Carga el banco del dominio y genera en segundo plano lo que falte. */
  load(domain: DomainLike): Promise<void> {
    const existing = this.loading.get(domain.id);
    if (existing) return existing;
    const promise = (async () => {
      await this.refresh(domain);
      const generated = await generateQuestionBank(this.db, this.text, domain, (m) => this.logger.log(m));
      if (generated) await this.refresh(domain);
    })().catch((error: Error) => {
      this.loading.delete(domain.id);
      this.logger.warn(`No he podido completar el banco de ${domain.id}: ${error.message}`);
    });
    this.loading.set(domain.id, promise);
    return promise;
  }

  /** Una redacción de la sonda que no repita palabras de lo ya preguntado, o null si no hay banco. */
  pick(domain: DomainLike, probeId: string, turns: InterviewTurn[]): BankVariant | null {
    const probe = domain.config.probes.find((p) => p.id === probeId);
    if (!probe) return null;
    // Primero el banco revisado a mano; el generado con IA, solo para sondas sin él.
    const reviewed = questionsFor(domain.id, probeId).map((question, variant) => ({ variant, question, reason: '' }));
    const variants = reviewed.length ? reviewed : (this.cache.get(domain.id)?.get(`${probeId}:${probe.intent}`) ?? []);
    return pickVariant(variants, turns);
  }

  private async refresh(domain: DomainLike) {
    const rows = await this.db.select().from(questionBank).where(eq(questionBank.domainId, domain.id));
    const byProbe = new Map<string, BankVariant[]>();
    for (const r of rows) {
      const key = `${r.probeId}:${r.intent}`;
      byProbe.set(key, [...(byProbe.get(key) ?? []), { variant: r.variant, question: r.question, reason: r.reason }]);
    }
    this.cache.set(domain.id, byProbe);
  }
}
