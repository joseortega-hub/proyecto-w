// Genera (o completa) el banco de preguntas de todos los dominios: pnpm questions
import { createGemini, GeminiTextProvider } from '../ai/gemini/gemini.providers.js';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { domainDefinitions } from '../domains/music.domain.js';
import { generateQuestionBank } from './question-bank.service.js';

const { db, client } = createDb();
const text = new GeminiTextProvider(createGemini(config.geminiApiKey), [
  ...new Set([config.geminiTextModel, ...config.geminiFallbackModels, config.geminiModel]),
]);

for (const domain of domainDefinitions) {
  const generated = await generateQuestionBank(db, text, domain, (m) => console.log(`  ${m}`));
  console.log(`${domain.name}: ${generated ? `${generated} sondas redactadas` : 'banco completo, nada que hacer'}.`);
}
await client.end();
