import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// El .env vive en la raíz del monorepo. Node 24 lo carga sin dependencias.
const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const optional = (name: string, fallback = '') => process.env[name]?.trim() || fallback;

export const config = {
  apiPort: Number(optional('API_PORT', '3001')),
  webUrl: optional('WEB_URL', 'http://localhost:5173'),
  databaseUrl: optional('DATABASE_URL', 'postgresql://proyecto:proyecto@localhost:5434/proyecto'),
  decisionProvider: optional('DECISION_PROVIDER', 'gemini') as 'gemini' | 'jev',
  typesafeApiKey: optional('TYPESAFE_API_KEY'),
  jevModel: optional('JEV_MODEL', 'jev-latest'),
  geminiApiKey: optional('GEMINI_API_KEY'),
  geminiModel: optional('GEMINI_MODEL', 'gemini-3.1-flash-lite'),
  /** Modelos de respaldo, en orden, si el principal está saturado. */
  geminiFallbackModels: optional('GEMINI_FALLBACK_MODELS', 'gemini-3.5-flash,gemini-3.5-flash-lite')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean),
  geminiEmbeddingModel: optional('GEMINI_EMBEDDING_MODEL', 'gemini-embedding-001'),
  jamendoClientId: optional('JAMENDO_CLIENT_ID'),
};

export type AppConfig = typeof config;
