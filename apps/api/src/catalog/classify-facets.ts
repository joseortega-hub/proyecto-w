import { and, eq, sql } from 'drizzle-orm';
import type { DecisionProvider, DecisionQuestion } from '../ai/decision-provider.js';
import type { Db } from '../db/client.js';
import { items } from '../db/schema.js';
import type { DomainDefinition, Preference } from '../domains/domain.types.js';

const BATCH = 8;
/** El plan gratuito admite 15 peticiones por minuto: una cada 5 s deja margen. */
const PAUSE_MS = 5_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Valores posibles de una faceta: las opciones (menos "me da igual"), los que pasan siempre y "other". */
export function facetValues(pref: Preference): string[] {
  return [
    ...new Set([...pref.options.map((o) => o.value).filter((v) => v !== pref.anyValue), ...pref.alwaysPass, 'other']),
  ];
}

/**
 * Clasifica, una sola vez, las facetas que la fuente no trae (p. ej. el idioma de una
 * canción con voz sin `lang` en Jamendo). Usa `choice` del DecisionProvider por lotes
 * y guarda el resultado en `items.facets`; los ya clasificados no se vuelven a tocar.
 */
export async function classifyMissingFacets(
  db: Db,
  decisions: DecisionProvider,
  domain: DomainDefinition,
  source: string,
  hints: Map<string, string>,
  log: (message: string) => void,
) {
  for (const pref of domain.config.preferences ?? []) {
    const missing = await db
      .select({
        id: items.id,
        externalId: items.externalId,
        title: items.title,
        subtitle: items.subtitle,
        description: items.description,
        tags: items.tags,
      })
      .from(items)
      .where(and(eq(items.domainId, domain.id), eq(items.source, source), sql`not (${items.facets} ? ${pref.key})`));
    if (!missing.length) continue;
    log(`${pref.label}: ${missing.length} ${domain.itemNounPlural} sin clasificar`);

    const criteria = Object.fromEntries(
      facetValues(pref).map((v) => [v, pref.options.find((o) => o.value === v)?.label ?? (v === 'other' ? 'Otro' : v)]),
    );
    let done = 0;
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      // Los datos del elemento van en el `state`; las instrucciones solo dicen qué decidir.
      const answers = await decisions
        .decide(
          {
            tarea: `Clasificar ${domain.itemNounPlural} por "${pref.label}"`,
            elementos: Object.fromEntries(
              batch.map((it) => [
                it.id,
                {
                  titulo: it.title,
                  autor: it.subtitle,
                  obra: it.description,
                  etiquetas: it.tags.slice(0, 10),
                  pistas: hints.get(it.externalId) ?? null,
                },
              ]),
            ),
          },
          Object.fromEntries(
            batch.map((it) => [
              it.id,
              {
                type: 'choice',
                instructions: `${pref.label} del elemento ${it.id} de "elementos". Si no hay pistas claras, elige "other".`,
                criteria,
              },
            ]),
          ) as Record<string, DecisionQuestion & { type: 'choice' }>,
        )
        .catch((error: Error) => {
          log(`  lote ${i / BATCH + 1} sin clasificar (${error.message.slice(0, 80)}); se reintentará en el próximo seed`);
          return null;
        });
      if (answers) {
        for (const it of batch) {
          const value = answers[it.id]?.choice;
          if (!value || !(value in criteria)) continue;
          await db
            .update(items)
            .set({ facets: sql`${items.facets} || ${JSON.stringify({ [pref.key]: value })}::jsonb` })
            .where(eq(items.id, it.id));
          done++;
        }
      }
      if (i + BATCH < missing.length) await sleep(PAUSE_MS);
    }
    log(`${pref.label}: ${done} clasificados`);
  }
}
