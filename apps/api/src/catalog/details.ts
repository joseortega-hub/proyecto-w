// Rellena los datos "para frikis" (items.details) de lo ya importado, sin IA: pnpm details [dominio…]
// Tira de las APIs de cada fuente (TMDB, RAWG, Open Library, Jamendo). Se puede reanudar:
// solo procesa los elementos con details vacío. Los créditos de MusicBrainz no van aquí:
// se piden al abrir la ficha. Para producción: DATABASE_URL=$PROD_DATABASE_URL pnpm details
import { and, eq, sql } from 'drizzle-orm';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { items } from '../db/schema.js';
import { compactDetails, type ItemDetails } from './item-details.js';
import { OpenLibraryAdapter } from './openlibrary.adapter.js';
import { RawgAdapter } from './rawg.adapter.js';
import { TmdbAdapter } from './tmdb.adapter.js';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const { db, client } = createDb();

const sources: Record<string, { domainId: string; source: string; create: () => { details(externalId: string): Promise<ItemDetails> } }> = {
  movies: { domainId: 'movies', source: 'tmdb', create: () => new TmdbAdapter(config.tmdbApiKey) },
  games: { domainId: 'games', source: 'rawg', create: () => new RawgAdapter(config.rawgApiKey) },
  books: { domainId: 'books', source: 'openlibrary', create: () => new OpenLibraryAdapter(config.openLibraryContact) },
};

const save = (id: string, details: ItemDetails) =>
  db.update(items).set({ details: sql`${items.details} || ${JSON.stringify(compactDetails(details))}::jsonb` }).where(eq(items.id, id));

for (const [name, s] of Object.entries(sources)) {
  if (only.length && !only.includes(name)) continue;
  let adapter: ReturnType<typeof s.create>;
  try {
    adapter = s.create();
  } catch (e) {
    console.warn(`${name}: se salta (${(e as Error).message})`);
    continue;
  }
  const pending = await db
    .select({ id: items.id, externalId: items.externalId })
    .from(items)
    .where(and(eq(items.domainId, s.domainId), eq(items.source, s.source), sql`${items.details} = '{}'::jsonb`));
  console.log(`${name}: ${pending.length} por rellenar`);
  let done = 0;
  let failed = 0;
  for (const row of pending) {
    try {
      await save(row.id, await adapter.details(row.externalId));
    } catch (e) {
      failed++;
      console.warn(`  ${row.externalId}: ${(e as Error).message}`);
    }
    if (++done % 50 === 0) console.log(`  ${done}/${pending.length}`);
  }
  console.log(`${name}: listo (${failed} con error; vuelve a ejecutar para reintentarlos)`);
}

// Música de Jamendo: álbum y año, de 50 en 50 canciones.
if (!only.length || only.includes('music')) {
  if (!config.jamendoClientId) console.warn('music: se salta (falta JAMENDO_CLIENT_ID)');
  else {
    const pending = await db
      .select({ id: items.id, externalId: items.externalId })
      .from(items)
      .where(and(eq(items.domainId, 'music'), eq(items.source, 'jamendo'), sql`${items.details} = '{}'::jsonb`));
    console.log(`music: ${pending.length} por rellenar`);
    for (let i = 0; i < pending.length; i += 50) {
      const batch = pending.slice(i, i + 50);
      const url = new URL('https://api.jamendo.com/v3.0/tracks/');
      url.search = new URLSearchParams({ client_id: config.jamendoClientId, format: 'json', limit: '50', id: batch.map((b) => b.externalId).join('+') }).toString();
      try {
        const res = await fetch(url);
        const body = (await res.json()) as { results?: { id: string; album_name?: string; releasedate?: string }[] };
        const byId = new Map((body.results ?? []).map((t) => [t.id, t]));
        for (const row of batch) {
          const t = byId.get(row.externalId);
          if (t) await save(row.id, { album: t.album_name || undefined, year: Number(t.releasedate?.slice(0, 4)) || undefined });
        }
      } catch (e) {
        console.warn(`  lote ${i}: ${(e as Error).message}`);
      }
      console.log(`  ${Math.min(i + 50, pending.length)}/${pending.length}`);
    }
  }
}

await client.end();
