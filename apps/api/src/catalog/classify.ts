// Clasifica las facetas que faltan (p. ej. idioma de la letra) sin volver a importar: pnpm classify
// Se puede reanudar: solo toca los elementos aún sin clasificar.
import { eq } from 'drizzle-orm';
import { createGemini, GeminiDecisionProvider } from '../ai/gemini/gemini.providers.js';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { items } from '../db/schema.js';
import { domainDefinitions } from '../domains/index.js';
import { classifyMissingFacets } from './classify-facets.js';

const { db, client } = createDb();
const decisions = new GeminiDecisionProvider(createGemini(config.geminiApiKey), [
  config.geminiModel,
  ...config.geminiFallbackModels.filter((m) => m !== config.geminiModel),
]);

try {
  for (const domain of domainDefinitions) {
    const sources = await db.selectDistinct({ source: items.source }).from(items).where(eq(items.domainId, domain.id));
    for (const { source } of sources) {
      // Sin la fuente original no hay letra: se clasifica con título, autor y etiquetas.
      await classifyMissingFacets(db, decisions, domain, source, new Map(), (m) => console.log(m));
    }
  }
} finally {
  await client.end();
}
