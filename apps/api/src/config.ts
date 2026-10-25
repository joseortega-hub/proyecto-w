import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// El .env vive en la raíz del monorepo. Node 24 lo carga sin dependencias.
const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const optional = (name: string, fallback = '') => process.env[name]?.trim() || fallback;
const list = (name: string, fallback = '') =>
  optional(name, fallback)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

export const config = {
  /** `PORT` lo fijan los hostings (Render) y la vista previa; si no, API_PORT. */
  apiPort: Number(optional('PORT') || optional('API_PORT', '3001')),
  webUrl: optional('WEB_URL', 'http://localhost:5173'),
  databaseUrl: optional('DATABASE_URL', 'postgresql://proyecto:proyecto@localhost:5434/proyecto'),
  /** Proveedor del perfil (`score`) y del encaje (`noul`): Gemini o Jev (con Gemini de respaldo). */
  decisionProvider: optional('DECISION_PROVIDER', 'gemini') as 'gemini' | 'jev',
  /**
   * Cadena de respaldo para elegir la siguiente pregunta de la entrevista (`choice`):
   * responde el primero disponible. Admite groq, laya, gemini y jev. Groq va primero
   * porque con el estado real de la entrevista es más rápido (0,4-1 s) que Laya en CPU
   * (1-2,5 s, en serie); Laya, sin cupo, cubre cuando Groq agota sus tokens por minuto.
   * En producción, sin Ollaya, basta con `groq,gemini` (Laya caído se salta solo).
   */
  decisionChain: list('DECISION_CHAIN', 'groq,laya,gemini'),
  /** Cadena de respaldo del texto (explicaciones y redacción en vivo): groq y gemini. */
  textChain: list('TEXT_CHAIN', 'groq,gemini'),
  /** Ollaya en local (compatible con la API de Jev) con el modelo Laya. */
  layaBaseUrl: optional('LAYA_BASE_URL', 'http://127.0.0.1:11435'),
  layaModel: optional('LAYA_MODEL', 'laya:multilingual'),
  /** Clave del servidor Laya (secreto `OLLAYA_API_KEY` del Space de Hugging Face). En local, vacía. */
  layaApiKey: optional('LAYA_API_KEY'),
  /** Margen del primer precalentado: un Space dormido tarda 1-2 min en despertar y cargar el modelo. */
  layaWarmupTimeoutMs: Number(optional('LAYA_WARMUP_TIMEOUT_MS', '180000')),
  /**
   * En caliente, una decisión de la entrevista tarda ~0,5-1 s en CPU, y Ollaya atiende
   * las peticiones de una en una: la segunda precarga (sí/no) espera a la primera.
   */
  layaTimeoutMs: Number(optional('LAYA_TIMEOUT_MS', '3000')),
  groqApiKey: optional('GROQ_API_KEY'),
  /** Modelo de Groq para las decisiones. Cada modelo tiene su cupo (≈30 peticiones y ~8K tokens por minuto). */
  groqModel: optional('GROQ_MODEL', 'openai/gpt-oss-120b'),
  /** Modelo de Groq para el texto; distinto del de decisiones para no compartir cupo. */
  groqTextModel: optional('GROQ_TEXT_MODEL', 'qwen/qwen3.8-27b'),
  groqFallbackModels: list('GROQ_FALLBACK_MODELS', 'openai/gpt-oss-20b'),
  typesafeApiKey: optional('TYPESAFE_API_KEY'),
  jevModel: optional('JEV_MODEL', 'jev-latest'),
  geminiApiKey: optional('GEMINI_API_KEY'),
  /** Modelo de las decisiones (siguiente pregunta, perfil, ¿encaja?). */
  geminiModel: optional('GEMINI_MODEL', 'gemini-3.1-flash-lite'),
  /**
   * Modelo del texto (preguntas y explicaciones). Va aparte para que cada uno tenga su
   * propio cupo del plan gratuito (15 peticiones/min por modelo).
   */
  geminiTextModel: optional('GEMINI_TEXT_MODEL', 'gemini-3.5-flash-lite'),
  /** Modelos de respaldo, en orden, si el principal está saturado. */
  geminiFallbackModels: list('GEMINI_FALLBACK_MODELS', 'gemini-3.5-flash,gemini-2.5-flash-lite,gemini-2.5-flash'),
  geminiEmbeddingModel: optional('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001'),
  /**
   * Contexto automático: si el navegador no manda zona horaria o posición, se usan estas
   * (Madrid). El tiempo sale de Open-Meteo, sin clave.
   */
  contextTimeZone: optional('CONTEXT_TIME_ZONE', 'Europe/Madrid'),
  contextLatitude: Number(optional('CONTEXT_LATITUDE', '40.4168')),
  contextLongitude: Number(optional('CONTEXT_LONGITUDE', '-3.7038')),
  /** Cliente OAuth de Google ("Aplicación web") para conectar YouTube. */
  googleClientId: optional('GOOGLE_CLIENT_ID'),
  googleClientSecret: optional('GOOGLE_CLIENT_SECRET'),
  /**
   * URI de redirección registrada en Google. Llega a la API a través del proxy `/api` de
   * la web (Vite en local, Vercel en producción), así que cuelga de WEB_URL.
   */
  googleRedirectUri: optional('GOOGLE_REDIRECT_URI', `${optional('WEB_URL', 'http://localhost:5173')}/api/youtube/callback`),
  /** Clave para cifrar los tokens de Google en la BD. Sin ella, se deriva de GOOGLE_CLIENT_SECRET. */
  tokenEncryptionKey: optional('TOKEN_ENCRYPTION_KEY') || optional('GOOGLE_CLIENT_SECRET'),
  /** Canciones como máximo por importación de YouTube (cada una gasta un embedding del cupo diario). */
  youtubeImportLimit: Number(optional('YOUTUBE_IMPORT_LIMIT', '400')),
  jamendoClientId: optional('JAMENDO_CLIENT_ID'),
  rawgApiKey: optional('RAWG_API_KEY'),
  /** API Key (v3) o token de lectura (v4) de TMDB. */
  tmdbApiKey: optional('TMDB_API_KEY'),
  /** Contacto opcional para el User-Agent de Open Library (sube el límite de 1 a 3 peticiones/s). */
  openLibraryContact: optional('OPEN_LIBRARY_CONTACT'),
  /** Last.fm (clave gratuita): artistas similares y los mejores de una etiqueta. */
  lastfmApiKey: optional('LASTFM_API_KEY'),
  /** Google Books (clave gratuita): ediciones en español reales y sinopsis. */
  googleBooksApiKey: optional('GOOGLE_BOOKS_API_KEY'),
  /** Contacto para el User-Agent de MusicBrainz (lo exigen sus condiciones). */
  musicBrainzContact: optional('MUSICBRAINZ_CONTACT'),
};

export type AppConfig = typeof config;
