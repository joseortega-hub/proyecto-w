import { createGroq } from '@ai-sdk/groq';
import { Logger } from '@nestjs/common';
import { config } from '../config.js';
import { GroqDecisionProvider, GroqTextProvider } from './groq/groq.providers.js';

// Respaldos gratuitos con API compatible con la de OpenAI. Se sirven con el cliente de Groq
// (mismo formato de petición y de salida estructurada) cambiando la URL.

const env = (name: string, fallback = '') => process.env[name]?.trim() || fallback;
const list = (name: string, fallback: string) =>
  env(name, fallback)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

export const compatibleConfig = {
  /** Cerebras (https://cloud.cerebras.ai): plan gratuito muy rápido con los mismos modelos que Groq. */
  cerebras: {
    apiKey: env('CEREBRAS_API_KEY'),
    baseURL: 'https://api.cerebras.ai/v1',
    decisionModels: list('CEREBRAS_MODELS', 'gpt-oss-120b,qwen-3.8-27b'),
    textModels: list('CEREBRAS_TEXT_MODELS', 'qwen-3.8-27b,gpt-oss-120b'),
  },
  /**
   * OpenRouter (https://openrouter.ai): modelos `:free` con cupo diario pequeño; último
   * respaldo antes de Gemini. Solo modelos con salida estructurada. Revisado el 25/10/2026 con una llamada real:
   * nemotron-3-super devolvía 404 (Nvidia lo retiró) y bloqueaba la cadena; los dos de abajo
   * responden en 1-3 s. El plan gratuito da 50 peticiones al día. Lista viva: openrouter.ai/api/v1/models
   */
  openrouter: {
    apiKey: env('OPENROUTER_API_KEY'),
    baseURL: 'https://openrouter.ai/api/v1',
    decisionModels: list('OPENROUTER_MODELS', 'xingchen-agi/xing4.0-29b-a4b:free,nvidia/nemotron-3.5-super-vl:free'),
    textModels: list('OPENROUTER_MODELS', 'xingchen-agi/xing4.0-29b-a4b:free,nvidia/nemotron-3.5-super-vl:free'),
  },
};

export type CompatibleName = keyof typeof compatibleConfig;
export type CompatibleProviders = Partial<Record<CompatibleName, { decisions: GroqDecisionProvider; text: GroqTextProvider }>>;

/** En Cerebras, los gpt-oss razonan poco y con esquema estricto, como en Groq. */
const cerebrasOptions = (model: string) =>
  model.startsWith('gpt-oss') ? { groq: { reasoningEffort: 'low', strictJsonSchema: true } } : undefined;

export function compatibleProviders(): CompatibleProviders {
  const out: CompatibleProviders = {};
  for (const name of Object.keys(compatibleConfig) as CompatibleName[]) {
    const c = compatibleConfig[name];
    if (!c.apiKey) continue;
    // OpenRouter pide identificar la app (HTTP-Referer y X-Title); Cerebras no se queja.
    const client = createGroq({
      apiKey: c.apiKey,
      baseURL: c.baseURL,
      headers: { 'HTTP-Referer': config.webUrl, 'X-Title': 'Sintonia' },
    });
    const options = {
      label: name,
      logger: new Logger(name === 'cerebras' ? 'Cerebras' : 'OpenRouter'),
      providerOptions: name === 'cerebras' ? cerebrasOptions : () => undefined,
    };
    out[name] = {
      decisions: new GroqDecisionProvider(client, c.decisionModels, options),
      text: new GroqTextProvider(client, c.textModels, options),
    };
  }
  return out;
}

/**
 * Cadena con los respaldos que tengan clave: si la cadena no los nombra, entran detrás de
 * Groq (o al principio si no hay Groq) y siempre antes de Gemini, para no tener que tocar
 * DECISION_CHAIN ni TEXT_CHAIN.
 */
export function withCompatible(chain: string[], available: CompatibleProviders): string[] {
  const missing = (Object.keys(available) as CompatibleName[]).filter((n) => !chain.includes(n));
  if (!missing.length) return chain;
  const at = chain.includes('groq') ? chain.indexOf('groq') + 1 : 0;
  return [...chain.slice(0, at), ...missing, ...chain.slice(at)];
}

// Que el import de config cargue el .env antes de leer process.env.
void config;
