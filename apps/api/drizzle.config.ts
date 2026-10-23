import { defineConfig } from 'drizzle-kit';
import { config } from './src/config.js';

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/db/schema.ts', './src/db/question-bank.schema.ts'],
  out: './drizzle',
  dbCredentials: { url: config.databaseUrl },
});
