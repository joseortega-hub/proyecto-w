import type { ItemDetails } from '../catalog/item-details.js';
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
import type { Anchor, BagEntry, InterviewTurn, MoodProfile, SessionPreferences, SessionResult, TextSignals } from '../interview/interview.types.js';
import type { Feedback, SeenRating, TasteProfile } from '../taste/taste.engine.js';
import type { YouTubeImportState } from '../youtube/youtube.types.js';

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
    /**
     * Dueño de un elemento privado (catálogo personal, p. ej. "Mi YouTube"): la persona
     * anónima que lo importó. Vacío en los catálogos públicos. Solo lo ve su dueño.
     */
    ownerId: text('owner_id').notNull().default(''),
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
    /** Datos "para frikis" (créditos, ficha técnica) que traen las APIs; nunca los genera la IA. */
    details: jsonb('details').$type<ItemDetails>().notNull().default({}),
    /** Embedding del texto del elemento (`pnpm embed`); null hasta calcularlo. */
    embedding: vector('embedding', { dimensions: 768 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('items_source_uq').on(t.domainId, t.source, t.externalId, t.ownerId),
    index('items_owner_idx').on(t.domainId, t.ownerId),
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
  /** Persona anónima (id guardado en su navegador) para leer su perfil de gustos. */
  userId: text('user_id'),
  /** Gustos de la persona al empezar (copia): la entrevista no pregunta por ellos. */
  taste: jsonb('taste').$type<TasteProfile>(),
  /** Lo que el texto inicial ya dejó claro (p. ej. "tranquilo"): esas dimensiones no se preguntan. */
  textSignals: jsonb('text_signals').$type<TextSignals>().notNull().default({}),
  /** Lo concreto que pidió en el texto inicial ("Marvel"): filtra o sube la búsqueda y enfoca las preguntas. */
  anchors: jsonb('anchors').$type<Anchor[]>().notNull().default([]),
  /** Gustos guardados que la persona desactivó para esta entrevista (no se borran de "Mis gustos"). */
  tasteOff: jsonb('taste_off').$type<string[]>().notNull().default([]),
  /** Lo que no quiere (claves de `tagGroups`, p. ej. `horror`): nunca se pregunta ni se recomienda. */
  exclusions: jsonb('exclusions').$type<string[]>().notNull().default([]),
  /** Bolsa de candidatas con su peso inicial (hasta ~150). Null en entrevistas sin texto ni filtros. */
  bag: jsonb('bag').$type<BagEntry[]>(),
  profile: jsonb('profile').$type<MoodProfile>(),
  result: jsonb('result').$type<SessionResult>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Gustos de largo plazo por persona y dominio (separados del ánimo de cada entrevista).
 * La persona es anónima: un id que su navegador genera y guarda. No se guarda texto libre.
 */
export const tasteProfiles = pgTable(
  'taste_profiles',
  {
    userId: text('user_id').notNull(),
    domainId: text('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    likes: text('likes').array().notNull().default(sql`'{}'::text[]`),
    dislikes: text('dislikes').array().notNull().default(sql`'{}'::text[]`),
    /** Peso aprendido por etiqueta (−1 a 1) con los 👍/👎. */
    learned: jsonb('learned').$type<Record<string, number>>().notNull().default({}),
    /** Valoración de cada elemento (`itemId → up | down`), para poder cambiarla o quitarla. */
    feedback: jsonb('feedback').$type<Record<string, Feedback>>().notNull().default({}),
    /** Preferencias previas habituales (p. ej. `{ language: 'es' }`), para que vengan marcadas. */
    preferences: jsonb('preferences').$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.domainId] })],
);

/**
 * Cuenta de YouTube conectada por una persona anónima (OAuth de Google). Los tokens van
 * cifrados (AES-256-GCM, `youtube/youtube.crypto.ts`); nunca salen del servidor.
 */
export const youtubeAccounts = pgTable('youtube_accounts', {
  userId: text('user_id').primaryKey(),
  channelId: text('channel_id'),
  channelTitle: text('channel_title'),
  refreshToken: text('refresh_token').notNull(),
  accessToken: text('access_token'),
  accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }),
  /** `expired` cuando Google rechaza el refresh token (en modo de pruebas caduca a los 7 días). */
  status: text('status').$type<'connected' | 'expired'>().notNull().default('connected'),
  /** Estado de la última importación, para la barra de progreso de la web. */
  importState: jsonb('import_state').$type<YouTubeImportState>(),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Trazas de IA ("Bajo el capó"): una fila por llamada, solo metadatos. Nunca guarda el texto
 * de la persona ni el estado de la decisión. Se borran pasadas 48 h.
 */
export const aiTraces = pgTable(
  'ai_traces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    sessionId: uuid('session_id'),
    domainId: text('domain_id'),
    task: text('task').notNull(),
    subject: text('subject').notNull(),
    provider: text('provider'),
    model: text('model'),
    ok: boolean('ok').notNull(),
    skipped: jsonb('skipped').$type<{ provider: string; reason: string; ms: number }[]>().notNull().default([]),
    latencyMs: integer('latency_ms').notNull(),
    totalMs: integer('total_ms').notNull(),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    /** Lo que costaría a precios de lista, en euros. */
    listCostEur: real('list_cost_eur').notNull().default(0),
    /** true si el proveedor está en un plan gratuito: se paga 0 €. */
    free: boolean('free').notNull().default(true),
    outcome: text('outcome'),
  },
  (t) => [index('ai_traces_session_idx').on(t.sessionId, t.createdAt), index('ai_traces_created_idx').on(t.createdAt)],
);

export type AiTraceRow = typeof aiTraces.$inferSelect;
/** Respuestas de fuentes externas (Wikidata, Last.fm, ListenBrainz, TMDB, Google Books): una vez por consulta. */
export const sourceCache = pgTable('source_cache', {
  key: text('key').primaryKey(),
  payload: jsonb('payload').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
});

export type YouTubeAccountRow = typeof youtubeAccounts.$inferSelect;
export type TasteRow = typeof tasteProfiles.$inferSelect;
export type ItemRow = typeof items.$inferSelect;
export type NewItemRow = typeof items.$inferInsert;
export type SessionRow = typeof interviewSessions.$inferSelect;

/** Artistas del Modo Perreo (temática secreta): ficha, datos de UrbanoPedia y foto en WebP (base64). */
export const perreoArtists = pgTable(
  'perreo_artists',
  {
    slug: text('slug').primaryKey(),
    name: text('name').notNull(),
    realName: text('real_name'),
    birthDate: text('birth_date'),
    country: text('country'),
    city: text('city'),
    /** Países y ciudades por separado cuando el artista tiene más de uno ("Puerto Rico / Estados Unidos"). */
    countries: text('countries').array().notNull().default(sql`'{}'::text[]`),
    debutYear: integer('debut_year'),
    /** Fama 0–100: percentil de oyentes de Last.fm (o de popularidad de Spotify si existiera) entre los 66. */
    fame: real('fame').notNull().default(0),
    listeners: integer('listeners'),
    styles: text('styles').array().notNull().default(sql`'{}'::text[]`),
    labels: jsonb('labels').$type<{ name: string; start: number | null; end: number | null }[]>().notNull().default([]),
    links: jsonb('links').$type<Record<string, string>>().notNull().default({}),
    bio: text('bio'),
    bioSource: text('bio_source'),
    youtubeChannelId: text('youtube_channel_id'),
    /** Slugs de artistas parecidos dentro de los 66 (Last.fm). */
    similar: text('similar').array().notNull().default(sql`'{}'::text[]`),
    photo: text('photo'),
    /** De dónde sale: 'urbanopedia' (los 66) o 'instagram' (los que sigue la persona). */
    source: text('source').notNull().default('urbanopedia'),
    /** La persona lo sigue en Instagram (insignia y filtro «Solo los que sigo»). */
    followed: boolean('followed').notNull().default(false),
    /** artist, group, producer, dj, label, composer, media, agency, other o unclassified. */
    kind: text('kind').notNull().default('artist'),
    /** Ficha mínima sin completar. */
    incomplete: boolean('incomplete').notNull().default(false),
    /** Apodo (editable a mano). */
    nickname: text('nickname'),
    /** Oculto del explorador (no se borra). Ni los imports ni `perreo:load` lo tocan. */
    hidden: boolean('hidden').notNull().default(false),
    /** Vídeo de YouTube de su canción destacada: sale primero en su lista. */
    featuredVideoId: text('featured_video_id'),
    /** Campos editados a mano (name, kind, country, styles…): `perreo:load` y los imports no los pisan. */
    manualFields: text('manual_fields').array().notNull().default(sql`'{}'::text[]`),
    /** «Nivel de calle» 0–100 (a mano): lo underground y de barrio que es. */
    streetLevel: integer('street_level'),
    /** active, hiatus, retired o deceased (a mano). */
    status: text('status'),
    /** Último año en activo, si lo dejó. */
    activeUntil: integer('active_until'),
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
    /** Colaboradores frecuentes (nombres libres). */
    collaborators: text('collaborators').array().notNull().default(sql`'{}'::text[]`),
    /** Color propio #rrggbb: a mano o el más vivo de su foto (desbloqueo y ficha). */
    color: text('color'),
  },
  (t) => [index('perreo_artists_fame_idx').on(t.fame)],
);

/** Novedades del Modo Perreo (Deezer y MusicBrainz, también lo que está por salir): las precalcula `pnpm perreo:pulse`. */
export const perreoReleases = pgTable(
  'perreo_releases',
  {
    /** 'deezer:<id>' o 'mb:<release-group>'. */
    id: text('id').primaryKey(),
    artistSlug: text('artist_slug').notNull(),
    /** 'album' (discos y EP) o 'song' (sencillos). */
    kind: text('kind').notNull(),
    recordType: text('record_type'),
    title: text('title').notNull(),
    /** AAAA-MM-DD (o AAAA / AAAA-MM si MusicBrainz no sabe más). */
    releaseDate: text('release_date').notNull(),
    coverUrl: text('cover_url'),
    link: text('link'),
    source: text('source').notNull(),
    fans: integer('fans'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('perreo_releases_date_idx').on(t.releaseDate), index('perreo_releases_artist_idx').on(t.artistSlug)],
);

/** Una foto al día de los números de cada artista (Last.fm, Deezer, YouTube y su puesto en el top de cada país). */
export const perreoStats = pgTable(
  'perreo_stats',
  {
    artistSlug: text('artist_slug').notNull(),
    day: text('day').notNull(),
    lastfmListeners: integer('lastfm_listeners'),
    lastfmPlays: bigint('lastfm_plays', { mode: 'number' }),
    deezerFans: integer('deezer_fans'),
    youtubeViews: bigint('youtube_views', { mode: 'number' }),
    youtubeSubs: integer('youtube_subs'),
    /** { "España": 3 }: puesto en `geo.getTopArtists` de Last.fm. */
    geo: jsonb('geo').$type<Record<string, number>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.artistSlug, t.day] })],
);

/** Cuentas de Instagram dudosas de la segunda pasada: la persona las confirma o descarta en el Modo Perreo. */
export const perreoReview = pgTable('perreo_review', {
  /** Usuario de Instagram. */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  reason: text('reason').notNull(),
  listeners: integer('listeners'),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  mbid: text('mbid'),
  qid: text('qid'),
  /** pending | accepted | rejected */
  status: text('status').notNull().default('pending'),
});
export type PerreoArtistRow = typeof perreoArtists.$inferSelect;

/** Quién ha desbloqueado alguna vez el Modo Perreo (identificador anónimo del navegador): sin fila, la temática no existe para esa persona. */
export const perreoUnlocks = pgTable('perreo_unlocks', {
  userId: text('user_id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Caché de respuestas de IA (decisiones y texto). La clave es un hash: el texto de la persona
 * nunca se guarda en claro. Caduca por `expires_at` y se limpia cada hora.
 */
export const aiCache = pgTable(
  'ai_cache',
  {
    key: text('key').primaryKey(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('ai_cache_expires_idx').on(t.expiresAt)],
);

/** Imagen adjunta a un comentario del buzón: comprimida en el navegador y en base64. */
export interface FeedbackImage {
  type: 'image/jpeg' | 'image/webp' | 'image/png';
  data: string;
}

/**
 * Buzón de comentarios, ideas y errores. La pantalla y la temática se rellenan solas en la
 * web; las imágenes van dentro (pocas y pequeñas). `pnpm feedback` lee los pendientes.
 */
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    message: text('message').notNull(),
    screen: text('screen'),
    domainId: text('domain_id'),
    context: jsonb('context').$type<Record<string, string | number>>().notNull().default({}),
    images: jsonb('images').$type<FeedbackImage[]>().notNull().default([]),
    userId: text('user_id'),
    status: text('status').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('feedback_status_idx').on(t.status, t.createdAt)],
);

/**
 * «Ya lo vi / leí / jugué / escuché»: lo que la persona anónima ya consumió, por temática.
 * No vuelve a recomendarse y su valoración (opcional) alimenta el perfil de gustos.
 */
export const seenItems = pgTable(
  'seen_items',
  {
    userId: text('user_id').notNull(),
    domainId: text('domain_id')
      .notNull()
      .references(() => domains.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    rating: text('rating').$type<SeenRating>(),
    /** De dónde viene la marca: la app o una importación (`letterboxd`, `goodreads`, `steam`). */
    source: text('source').notNull().default('app'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] }), index('seen_items_user_domain_idx').on(t.userId, t.domainId)],
);

export type SeenRow = typeof seenItems.$inferSelect;
