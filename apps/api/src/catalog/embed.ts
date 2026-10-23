// Calcula los embeddings del catálogo: pnpm embed [dominio…] [--all] [--batch 50]
// Se puede reanudar: solo procesa los elementos sin embedding (salvo con --all).
import { and, eq, isNull, sql } from 'drizzle-orm';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { domains, items } from '../db/schema.js';
import { createGemini, GeminiEmbeddingProvider } from '../ai/gemini/gemini.providers.js';
import { itemEmbeddingText } from '../interview/interview.engine.js';

const args = process.argv.slice(2);
const all = args.includes('--all');
const batchSize = Math.min(100, Number(args[args.indexOf('--batch') + 1]) || 50);
/** Dominios a procesar (por defecto, todos): `pnpm embed games movies`. */
const only = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--batch');
/**
 * Márgenes bajo los límites por minuto del plan gratuito: unos 30 000 tokens y
 * 100 peticiones, contando cada texto del lote como una petición.
 */
const TOKENS_PER_MINUTE = 20_000;
const TEXTS_PER_MINUTE = 80;

const { db, client } = createDb();
const embedder = new GeminiEmbeddingProvider(createGemini(config.geminiApiKey), config.geminiEmbeddingModel);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isRateLimit = (e: unknown) =>
  /429|quota|rate.?limit|resource.?exhausted/i.test(String((e as Error)?.message ?? e));

/** El cupo diario (1000 textos por modelo en el plan gratuito) no se arregla esperando un minuto. */
const isDailyQuota = (e: unknown) => /per.?day|PerDay/i.test(String((e as Error)?.message ?? e));

class DailyQuotaError extends Error {}

async function embedWithRetry(texts: string[]): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await embedder.embed(texts, 'document');
    } catch (error) {
      if (isDailyQuota(error)) throw new DailyQuotaError(String((error as Error).message));
      if (!isRateLimit(error) || attempt >= 5) throw error;
      const wait = 30_000 * attempt;
      console.log(`  Límite del plan gratuito; espero ${wait / 1000} s (intento ${attempt})…`);
      await sleep(wait);
    }
  }
}

let done = 0;
try {
  for (const domain of await db.select().from(domains)) {
    if (only.length && !only.includes(domain.id)) continue;
    const where = all ? eq(items.domainId, domain.id) : and(eq(items.domainId, domain.id), isNull(items.embedding));
    const pending = await db.select().from(items).where(where).orderBy(items.id);
    console.log(`${domain.name}: ${pending.length} elementos por procesar con ${embedder.name}.`);

    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      const texts = batch.map((it) => itemEmbeddingText(it, domain.config, domain.itemNoun));
      const started = Date.now();
      const vectors = await embedWithRetry(texts);
      // Cada lote se guarda al momento: si el script se corta, se retoma donde iba.
      await db.transaction(async (tx) => {
        for (const [k, it] of batch.entries()) {
          await tx.update(items).set({ embedding: vectors[k] }).where(eq(items.id, it.id));
        }
      });
      done += batch.length;
      console.log(`  ${Math.min(i + batchSize, pending.length)}/${pending.length}`);

      // Pausa según el límite más estricto: tokens (≈ 4 caracteres por token) o textos.
      const tokens = texts.join(' ').length / 4;
      const pause =
        60_000 * Math.max(tokens / TOKENS_PER_MINUTE, texts.length / TEXTS_PER_MINUTE) - (Date.now() - started);
      if (i + batchSize < pending.length && pause > 0) await sleep(pause);
    }
  }
  const [{ total, withEmbedding }] = await db
    .select({
      total: sql<number>`count(*)::int`,
      withEmbedding: sql<number>`count(${items.embedding})::int`,
    })
    .from(items);
  console.log(`Hecho: ${done} embeddings nuevos. Catálogo: ${withEmbedding}/${total} con embedding.`);
} catch (error) {
  if (!(error instanceof DailyQuotaError)) throw error;
  const retry = /retry in ([\d.hms]+)/i.exec(error.message)?.[1];
  console.log(
    `Se ha agotado el cupo diario de embeddings del plan gratuito tras ${done} nuevos. ` +
      `Lo guardado se conserva: vuelve a lanzar pnpm embed${retry ? ` dentro de ${retry.replace(/\.\d+s$/, 's')}` : ' mañana'} y seguirá donde lo dejó.`,
  );
  process.exitCode = 1;
} finally {
  await client.end();
}
