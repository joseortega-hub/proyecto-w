import { Global, Logger, Module } from '@nestjs/common';
import { config } from '../config.js';
import { DECISION_PROVIDER, type DecisionProvider } from './decision-provider.js';
import { EMBEDDING_PROVIDER } from './embedding-provider.js';
import { FallbackDecisionProvider } from './fallback-decision.provider.js';
import {
  createGemini,
  GeminiDecisionProvider,
  GeminiEmbeddingProvider,
  GeminiTextProvider,
} from './gemini/gemini.providers.js';
import { JevDecisionProvider } from './jev/jev-decision.provider.js';
import { TEXT_PROVIDER } from './text-provider.js';

const GEMINI = Symbol('Gemini');

@Global()
@Module({
  providers: [
    { provide: GEMINI, useFactory: () => createGemini(config.geminiApiKey) },
    {
      provide: DECISION_PROVIDER,
      inject: [GEMINI],
      useFactory: (google: ReturnType<typeof createGemini>): DecisionProvider => {
        const gemini = new GeminiDecisionProvider(google, config.geminiModel);
        let provider: DecisionProvider = gemini;
        if (config.decisionProvider === 'jev') {
          if (config.typesafeApiKey) {
            provider = new FallbackDecisionProvider(new JevDecisionProvider(config.typesafeApiKey, config.jevModel), gemini);
          } else {
            new Logger('Decisiones').warn('DECISION_PROVIDER=jev pero falta TYPESAFE_API_KEY; uso Gemini');
          }
        }
        new Logger('Decisiones').log(`Proveedor de decisiones: ${provider.name}`);
        return provider;
      },
    },
    {
      provide: TEXT_PROVIDER,
      inject: [GEMINI],
      useFactory: (google: ReturnType<typeof createGemini>) => new GeminiTextProvider(google, config.geminiModel),
    },
    {
      provide: EMBEDDING_PROVIDER,
      inject: [GEMINI],
      useFactory: (google: ReturnType<typeof createGemini>) =>
        new GeminiEmbeddingProvider(google, config.geminiEmbeddingModel),
    },
  ],
  exports: [DECISION_PROVIDER, TEXT_PROVIDER, EMBEDDING_PROVIDER],
})
export class AiModule {}
