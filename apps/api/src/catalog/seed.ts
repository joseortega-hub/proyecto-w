// Siembra los dominios y sus catálogos: pnpm seed [dominio…] [límite]
// Ejemplos: pnpm seed (todos), pnpm seed games, pnpm seed movies books 300.
// Los dominios cuya clave falta en .env se saltan con un aviso.
import { sql } from 'drizzle-orm';
import { createGemini, GeminiDecisionProvider } from '../ai/gemini/gemini.providers.js';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { domainAttributes, domains, items } from '../db/schema.js';
import { domainDefinitions, findDomain } from '../domains/index.js';
import type { CatalogAdapter } from './catalog-adapter.js';
import { classifyMissingFacets } from './classify-facets.js';
import { JamendoAdapter } from './jamendo.adapter.js';
import { OpenLibraryAdapter } from './openlibrary.adapter.js';
import { RawgAdapter } from './rawg.adapter.js';
import { TmdbAdapter } from './tmdb.adapter.js';

/** Adaptador y tamaño por defecto de cada dominio. */
const ADAPTERS: Record<string, { create: () => CatalogAdapter; limit: number }> = {
  music: { create: () => new JamendoAdapter(config.jamendoClientId), limit: 1100 },
  games: { create: () => new RawgAdapter(config.rawgApiKey), limit: 500 },
  movies: { create: () => new TmdbAdapter(config.tmdbApiKey), limit: 450 },
  books: { create: () => new OpenLibraryAdapter(config.openLibraryContact), limit: 400 },
};

const args = process.argv.slice(2);
const limitArg = args.find((a) => /^\d+$/.test(a));
const wanted = args.filter((a) => !/^\d+$/.test(a));
for (const id of wanted) if (!findDomain(id)) throw new Error(`No existe el dominio "${id}"`);
const selected = wanted.length ? wanted : domainDefinitions.map((d) => d.id);

const { db, client } = createDb();

// La configuración de todos los dominios se actualiza siempre, aunque no se importe su catálogo.
for (const d of domainDefinitions) {
  const row = { id: d.id, name: d.name, itemNoun: d.itemNoun, itemNounPlural: d.itemNounPlural, config: d.config };
  await db.insert(domains).values(row).onConflictDoUpdate({ target: domains.id, set: row });
  await db.delete(domainAttributes).where(sql`${domainAttributes.domainId} = ${d.id}`);
  await db.insert(domainAttributes).values(
    d.config.attributes.map((a, position) => ({
      domainId: d.id,
      key: a.key,
      label: a.label,
      kind: a.kind,
      description: a.description,
      lowLabel: a.lowLabel ?? null,
      highLabel: a.highLabel ?? null,
      position,
    })),
  );
  console.log(`Dominio "${d.name}" listo.`);
}

const decisions = new GeminiDecisionProvider(createGemini(config.geminiApiKey), [
  config.geminiModel,
  ...config.geminiFallbackModels.filter((m) => m !== config.geminiModel),
]);

try {
  for (const id of selected) {
    const entry = ADAPTERS[id];
    let adapter: CatalogAdapter;
    try {
      adapter = entry.create();
    } catch (error) {
      console.warn(`Me salto ${id}: ${(error as Error).message}`);
      continue;
    }
    const limit = Number(limitArg ?? entry.limit);
    console.log(`Importando ${adapter.source} (hasta ${limit} elementos)…`);
    const imported = await adapter.fetchItems({ limit, onProgress: (m) => console.log(`  ${m}`) });

    for (let i = 0; i < imported.length; i += 200) {
      const chunk = imported.slice(i, i + 200).map(({ classifyHints: _hints, ...it }) => ({ ...it, domainId: adapter.domainId }));
      await db
        .insert(items)
        .values(chunk)
        .onConflictDoUpdate({
          target: [items.domainId, items.source, items.externalId],
          set: {
            title: sql`excluded.title`,
            subtitle: sql`excluded.subtitle`,
            description: sql`excluded.description`,
            imageUrl: sql`excluded.image_url`,
            mediaUrl: sql`excluded.media_url`,
            externalUrl: sql`excluded.external_url`,
            durationSec: sql`excluded.duration_sec`,
            attributes: sql`excluded.attributes`,
            tags: sql`excluded.tags`,
            popularity: sql`excluded.popularity`,
            // Lo que trae la fuente manda, pero no se pierde lo que ya se clasificó antes.
            facets: sql`${items.facets} || excluded.facets`,
          },
        });
    }
    console.log(`${adapter.source}: ${imported.length} elementos guardados.`);

    const definition = findDomain(adapter.domainId)!;
    const hints = new Map(imported.flatMap((it) => (it.classifyHints ? [[it.externalId, it.classifyHints]] : [])));
    await classifyMissingFacets(db, decisions, definition, adapter.source, hints, (m) => console.log(`  ${m}`));
  }

  const counts = await db
    .select({ domainId: items.domainId, count: sql<number>`count(*)::int` })
    .from(items)
    .groupBy(items.domainId);
  console.log(`Catálogo: ${counts.map((c) => `${c.domainId} ${c.count}`).join(', ')}.`);
} finally {
  await client.end();
}
