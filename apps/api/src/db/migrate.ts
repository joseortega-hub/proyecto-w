import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client.js';

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');
const { db, client } = createDb();

await migrate(db, { migrationsFolder });
await client.end();
console.log('Migraciones aplicadas.');
