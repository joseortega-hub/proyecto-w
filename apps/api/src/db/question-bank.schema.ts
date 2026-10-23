import { integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { domains } from './schema.js';

/**
 * Banco de preguntas pregenerado: varias redacciones por sonda y dominio. La entrevista
 * toma una de aquí en vez de redactar en vivo, así cada pregunta cuesta una sola llamada
 * (la decisión). `intent` guarda la sonda con la que se redactó: si cambia, se regenera.
 */
export const questionBank = pgTable(
  'question_bank',
  {
    domainId: text('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    probeId: text('probe_id').notNull(),
    variant: integer('variant').notNull(),
    intent: text('intent').notNull(),
    question: text('question').notNull(),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.domainId, t.probeId, t.variant] })],
);

export type QuestionBankRow = typeof questionBank.$inferSelect;
