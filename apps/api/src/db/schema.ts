import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core';
import type { DomainConfig } from '../domains/domain.types.js';
import type { InterviewContext } from '../interview/interview.context.js';
import type { InterviewTurn, MoodProfile, SessionPreferences, SessionResult } from '../interview/interview.types.js';

/** Un dominio del catálogo (música, películas…) con su configuración de entrevista. */
export const domains = pgTable('domains', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  itemNoun: text('item_noun').notNull(),
  itemNounPlural: text('item_noun_plural').notNull(),
  config: jsonb('config').$type<DomainConfig>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Atributos que describen a los elementos de un dominio (energía, voz…). */
export const domainAttributes = pgTable(
  'domain_attributes',
  {
    domainId: text('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    kind: text('kind').$type<'scale' | 'tags'>().notNull(),
    description: text('description').notNull(),
    lowLabel: text('low_label'),
    highLabel: text('high_label'),
    position: integer('position').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.domainId, t.key] })],
);

/** Elementos del catálogo, comunes a todos los dominios. */
export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    domainId: text('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    description: text('description'),
    imageUrl: text('image_url'),
    mediaUrl: text('media_url'),
    externalUrl: text('external_url'),
    durationSec: integer('duration_sec'),
    /** Valores de escala (0–1) por clave de atributo. */
    attributes: jsonb('attributes').$type<Record<string, number>>().notNull().default({}),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    /** Valores categóricos para las preferencias previas del dominio (`language: 'es'`, `platforms: ['pc', 'switch']`). */
    facets: jsonb('facets').$type<Record<string, string | string[]>>().notNull().default({}),
    popularity: real('popularity').notNull().default(0),
    /** Embedding del texto del elemento (`pnpm embed`); null hasta calcularlo. */
    embedding: vector('embedding', { dimensions: 768 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('items_source_uq').on(t.domainId, t.source, t.externalId),
    index('items_domain_idx').on(t.domainId),
    index('items_tags_idx').using('gin', t.tags),
    index('items_embedding_idx').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

/** Una entrevista: sus turnos, el perfil calculado y la lista resultante. */
export const interviewSessions = pgTable('interview_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  domainId: text('domain_id')
    .notNull()
    .references(() => domains.id, { onDelete: 'cascade' }),
  status: text('status').$type<'asking' | 'ready' | 'done'>().notNull().default('asking'),
  turns: jsonb('turns').$type<InterviewTurn[]>().notNull().default([]),
  /** Texto opcional con el que la persona describe cómo está antes de las preguntas. */
  initialText: text('initial_text'),
  /** Preferencias previas elegidas (filtros duros), p. ej. `{ language: 'es' }`. */
  preferences: jsonb('preferences').$type<SessionPreferences>().notNull().default({}),
  context: jsonb('context').$type<InterviewContext>().notNull().default({}),
  profile: jsonb('profile').$type<MoodProfile>(),
  result: jsonb('result').$type<SessionResult>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ItemRow = typeof items.$inferSelect;
export type NewItemRow = typeof items.$inferInsert;
export type SessionRow = typeof interviewSessions.$inferSelect;
