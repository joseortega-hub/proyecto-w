// Rellena las facetas estructuradas de lo ya importado, sin IA: pnpm facets [dominio…] [--prod]
// - Películas (TMDB): productoras (`companies`) y colección o saga (`collection`).
// - Videojuegos (RAWG): desarrolladora y editora (`companies`), desde los créditos ya guardados.
// - Libros (Open Library): idiomas con edición real y, si la hay en español, su título.
// Con --prod rellena la BD de producción (PROD_DATABASE_URL del .env); sin él, la local.
// Se puede reanudar: marca cada elemento con `details.facetsAt` y se salta los ya hechos.
import { and, eq, sql } from 'drizzle-orm';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { items } from '../db/schema.js';
import { OpenLibraryAdapter } from './openlibrary.adapter.js';
import { gameEntityFacets } from './rawg.adapter.js';
import { TmdbAdapter } from './tmdb.adapter.js';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const prod = process.argv.includes('--prod');
const target = prod ? process.env.PROD_DATABASE_URL?.trim() : undefined;
if (prod && !target) {
  console.error('Falta PROD_DATABASE_URL en el .env (cadena de conexión de Neon).');
  process.exit(1);
}
const { db, client } = createDb(target);
console.log(prod ? 'Base de datos: producción (Neon)' : 'Base de datos: local');

type Patch = { facets?: Record<string, string | string[]>; title?: string | null };

const save = (id: string, patch: Patch) =>
  db
    .update(items)
    .set({
      facets: sql`${items.facets} || ${JSON.stringify(patch.facets ?? {})}::jsonb`,
      details: sql`${items.details} || ${JSON.stringify({ facetsAt: new Date().toISOString() })}::jsonb`,
      ...(patch.title ? { title: patch.title } : {}),
    })
    .where(eq(items.id, id));

const pendingOf = (domainId: string, source: string) =>
  db
    .select({ id: items.id, externalId: items.externalId, details: items.details })
    .from(items)
    .where(and(eq(items.domainId, domainId), eq(items.source, source), sql`not (${items.details} ? 'facetsAt')`));

async function fill(name: string, domainId: string, source: string, work: (row: { externalId: string; details: Record<string, unknown> }) => Promise<Patch | null>) {
  if (only.length && !only.includes(name)) return;
  const pending = await pendingOf(domainId, source);
  console.log(`${name}: ${pending.length} por rellenar`);
  let done = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      const patch = await work({ externalId: row.externalId, details: row.details as Record<string, unknown> });
      if (patch) await save(row.id, patch);
    } catch (e) {
      failed++;
      console.warn(`  ${row.externalId}: ${(e as Error).message}`);
    }
    if (++done % 50 === 0) console.log(`  ${done}/${pending.length}`);
  }
  console.log(`${name}: listo (${failed} con error; vuelve a ejecutar para reintentarlos)`);
}

const named = (list: unknown) => (Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').map((name) => ({ name })) : []);

await fill('games', 'games', 'rawg', async ({ details }) => ({ facets: gameEntityFacets({ developers: named(details.developers), publishers: named(details.publishers) }) }));

if (config.tmdbApiKey) {
  const tmdb = new TmdbAdapter(config.tmdbApiKey);
  await fill('movies', 'movies', 'tmdb', async ({ externalId }) => ({ facets: await tmdb.entityFacets(externalId) }));
} else if (!only.length || only.includes('movies')) console.warn('movies: se salta (falta TMDB_API_KEY)');

const books = new OpenLibraryAdapter(config.openLibraryContact);
await fill('books', 'books', 'openlibrary', async ({ externalId }) => {
  const found = await books.languageFacets(externalId);
  return found ? { facets: { languages: found.languages }, title: found.title } : {};
});

await client.end();
