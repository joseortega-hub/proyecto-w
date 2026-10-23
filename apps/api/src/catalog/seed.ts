// Siembra los dominios y el catálogo de música desde Jamendo: pnpm seed [límite]
import { sql } from 'drizzle-orm';
import { createGemini, GeminiDecisionProvider } from '../ai/gemini/gemini.providers.js';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { domainAttributes, domains, items } from '../db/schema.js';
import { domainDefinitions } from '../domains/music.domain.js';
import type { CatalogAdapter } from './catalog-adapter.js';
import { classifyMissingFacets } from './classify-facets.js';
import { JamendoAdapter } from './jamendo.adapter.js';

const limit = Number(process.argv[2] ?? 1100);
const { db, client } = createDb();

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

const adapters: CatalogAdapter[] = [new JamendoAdapter(config.jamendoClientId)];
const decisions = new GeminiDecisionProvider(createGemini(config.geminiApiKey), [
  config.geminiModel,
  ...config.geminiFallbackModels.filter((m) => m !== config.geminiModel),
]);

for (const adapter of adapters) {
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

  const definition = domainDefinitions.find((d) => d.id === adapter.domainId)!;
  const hints = new Map(imported.flatMap((it) => (it.classifyHints ? [[it.externalId, it.classifyHints]] : [])));
  await classifyMissingFacets(db, decisions, definition, adapter.source, hints, (m) => console.log(`  ${m}`));
}

const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(items);
console.log(`Catálogo total: ${count} elementos.`);
await client.end();
