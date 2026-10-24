import { sql } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { items } from '../db/schema.js';
import type { ImportedItem } from './catalog-adapter.js';

/**
 * Guarda elementos importados: los nuevos se insertan y los que ya existían se actualizan
 * con lo que trae la fuente, sin perder las facetas ya clasificadas. Devuelve sus ids.
 */
export async function upsertItems(db: Db, domainId: string, imported: ImportedItem[]): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < imported.length; i += 200) {
    const chunk = imported.slice(i, i + 200).map(({ classifyHints: _hints, ...it }) => ({ ...it, domainId }));
    const rows = await db
      .insert(items)
      .values(chunk)
      .onConflictDoUpdate({
        target: [items.domainId, items.source, items.externalId, items.ownerId],
        set: {
          title: sql`excluded.title`,
          subtitle: sql`excluded.subtitle`,
          description: sql`coalesce(excluded.description, ${items.description})`,
          imageUrl: sql`excluded.image_url`,
          mediaUrl: sql`excluded.media_url`,
          externalUrl: sql`excluded.external_url`,
          durationSec: sql`excluded.duration_sec`,
          attributes: sql`excluded.attributes`,
          // Las etiquetas se suman: una búsqueda en directo añade la del ancla ("marvel").
          tags: sql`${items.tags} || array(select t from unnest(excluded.tags) t where t <> all(${items.tags}))`,
          popularity: sql`greatest(${items.popularity}, excluded.popularity)`,
          // Lo que trae la fuente manda, pero no se pierde lo que ya se clasificó antes.
          facets: sql`${items.facets} || excluded.facets`,
          // Los créditos nuevos se suman a los ya guardados (p. ej. los de MusicBrainz).
          details: sql`${items.details} || excluded.details`,
        },
      })
      .returning({ id: items.id });
    ids.push(...rows.map((r) => r.id));
  }
  return ids;
}
