import { Global, Logger, Module } from '@nestjs/common';
import { config } from '../config.js';
import { DECISION_PROVIDER, INTERVIEW_DECISION_PROVIDER, type DecisionProvider } from './decision-provider.js';
import { EMBEDDING_PROVIDER } from './embedding-provider.js';
import {
  createGemini,
  GeminiDecisionProvider,
  GeminiEmbeddingProvider,
  GeminiTextProvider,
} from './gemini/gemini.providers.js';
import { compatibleProviders, withCompatible } from './compatible.providers.js';
import { createGroqClient, GroqDecisionProvider, GroqTextProvider } from './groq/groq.providers.js';
import { JevDecisionProvider } from './jev/jev-decision.provider.js';
import { LayaDecisionProvider } from './laya/laya-decision.provider.js';
import { DecisionChain, TextChain } from './provider-chain.js';
import { TEXT_PROVIDER, type TextProvider } from './text-provider.js';

const logger = new Logger('IA');
const announce = <P extends { name: string }>(task: string, provider: P) => {
  logger.log(`${task}: ${provider.name}`);
  return provider;
};

/**
 * Cadena de modelos: primero el suyo, luego los de respaldo y, como último recurso, el
 * principal de la otra tarea. Así decisiones y texto no compiten por el mismo cupo.
 */
const chain = (primary: string, fallbacks: string[], lastResort: string) => [...new Set([primary, ...fallbacks, lastResort])];

const google = createGemini(config.geminiApiKey);
const gemini = {
  decisions: new GeminiDecisionProvider(google, chain(config.geminiModel, config.geminiFallbackModels, config.geminiTextModel)),
  text: new GeminiTextProvider(google, chain(config.geminiTextModel, config.geminiFallbackModels, config.geminiModel)),
};
const groq = config.groqApiKey ? createGroqClient(config.groqApiKey) : null;
/** Respaldos gratuitos compatibles con la API de OpenAI (Cerebras, OpenRouter): solo si hay clave. */
const compatible = compatibleProviders();
const jev = config.typesafeApiKey
  ? new JevDecisionProvider({ apiKey: config.typesafeApiKey, model: config.jevModel, maxRetries: 0 })
  : null;

/** Perfil (`score`) y encaje (`noul`): Gemini, o Jev con Gemini de respaldo. */
function mainDecisions(): DecisionProvider {
  if (config.decisionProvider === 'jev' && !jev) logger.warn('DECISION_PROVIDER=jev pero falta TYPESAFE_API_KEY; uso Gemini');
  const provider = config.decisionProvider === 'jev' && jev ? new DecisionChain([jev, gemini.decisions]) : gemini.decisions;
  return announce('Perfil y encaje', provider);
}

/** Siguiente pregunta de la entrevista: la cadena de DECISION_CHAIN (por defecto Groq → Laya → Gemini). */
function interviewDecisions(): DecisionProvider {
  const providers = withCompatible(config.decisionChain, compatible).flatMap((name): DecisionProvider[] => {
    switch (name) {
      case 'cerebras':
      case 'openrouter': {
        const extra = compatible[name];
        if (extra) return [extra.decisions];
        logger.warn(`DECISION_CHAIN incluye ${name} pero falta su clave; se salta`);
        return [];
      }
      case 'laya': {
        const laya = new LayaDecisionProvider(config.layaBaseUrl, config.layaModel, config.layaTimeoutMs);
        void laya.warmUp();
        return [laya];
      }
      case 'groq':
        if (groq) return [new GroqDecisionProvider(groq, chain(config.groqModel, config.groqFallbackModels, config.groqTextModel))];
        logger.warn('DECISION_CHAIN incluye groq pero falta GROQ_API_KEY; se salta');
        return [];
      case 'jev':
        if (jev) return [jev];
        logger.warn('DECISION_CHAIN incluye jev pero falta TYPESAFE_API_KEY; se salta');
        return [];
      case 'gemini':
        return [gemini.decisions];
      default:
        logger.warn(`DECISION_CHAIN: proveedor desconocido "${name}"`);
        return [];
    }
  });
  return announce('Siguiente pregunta', providers.length > 1 ? new DecisionChain(providers) : (providers[0] ?? gemini.decisions));
}

/** Texto: la cadena de TEXT_CHAIN (por defecto Groq → Gemini). */
function textProvider(): TextProvider {
  const providers = withCompatible(config.textChain, compatible).flatMap((name): TextProvider[] => {
    if (name === 'gemini') return [gemini.text];
    if ((name === 'cerebras' || name === 'openrouter') && compatible[name]) return [compatible[name].text];
    if (name === 'groq' && groq) return [new GroqTextProvider(groq, chain(config.groqTextModel, config.groqFallbackModels, config.groqModel))];
    logger.warn(`TEXT_CHAIN: "${name}" no disponible; se salta`);
    return [];
  });
  return announce('Texto', providers.length > 1 ? new TextChain(providers) : (providers[0] ?? gemini.text));
}

@Global()
@Module({
  providers: [
    { provide: DECISION_PROVIDER, useFactory: mainDecisions },
    { provide: INTERVIEW_DECISION_PROVIDER, useFactory: interviewDecisions },
    { provide: TEXT_PROVIDER, useFactory: textProvider },
    { provide: EMBEDDING_PROVIDER, useFactory: () => new GeminiEmbeddingProvider(google, config.geminiEmbeddingModel) },
  ],
  exports: [DECISION_PROVIDER, INTERVIEW_DECISION_PROVIDER, TEXT_PROVIDER, EMBEDDING_PROVIDER],
})
export class AiModule {}
