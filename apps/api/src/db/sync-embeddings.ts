// Copia los embeddings de la BD local a producción: pnpm sync-embeddings
// Así `pnpm embed` se lanza una sola vez (en local) y no se gasta dos veces el cupo diario de Gemini.
// Solo actualiza los elementos que en producción aún no tienen embedding (con --all, todos).
// Lee el destino de PROD_DATABASE_URL (en el .env, nunca en Git).
import postgres from 'postgres';
import { config } from '../config.js';

const target = process.env.PROD_DATABASE_URL?.trim();
if (!target) {
  console.error('Falta PROD_DATABASE_URL en el .env (cadena de conexión de Neon).');
  process.exit(1);
}
const all = process.argv.includes('--all');
const BATCH = 100;

const source = postgres(config.databaseUrl, { max: 1 });
const dest = postgres(target, { max: 1 });

const missing = new Set(
  (await dest<{ id: string }[]>`select id from items ${all ? dest`` : dest`where embedding is null`}`).map((r) => r.id),
);
const rows = (
  await source<{ id: string; embedding: string }[]>`select id, embedding::text from items where embedding is not null`
).filter((r) => missing.has(r.id));

for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH).map((r) => [r.id, r.embedding]);
  await dest`
    update items set embedding = v.embedding::vector
    from (values ${dest(batch)}) as v(id, embedding)
    where items.id = v.id::uuid`;
  console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}
await dest`analyze items`;
console.log(`Embeddings copiados a producción: ${rows.length} (faltaban ${missing.size}).`);
await Promise.all([source.end(), dest.end()]);
