import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

export function createDb(url = config.databaseUrl) {
  const client = postgres(url, { max: 10 });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>['db'];
