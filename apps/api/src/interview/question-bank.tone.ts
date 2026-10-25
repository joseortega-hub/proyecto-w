// Revisa el tono del banco de preguntas generado con IA (tabla question_bank): pnpm tone:bank [--prod]
// Borra solo las variantes con jerga o coloquialismos; la API las redacta de nuevo al arrancar
// (con la instrucción de tono). Las revisadas a mano viven en question-texts.ts y no se tocan.
import { createDb } from '../db/client.js';
import { questionBank } from '../db/question-bank.schema.js';
import { and, eq } from 'drizzle-orm';

const VETADAS =
  /\b(te pongo|te preparo|te echo|dale|bro|flipar|flipan|flipa|mola|molan|a tope|en la movie|colegas?|tranquilito|ligerito|sencillito|buen rollo)\b/i;

const prod = process.argv.includes('--prod');
const target = prod ? process.env.PROD_DATABASE_URL?.trim() : undefined;
if (prod && !target) {
  console.error('Falta PROD_DATABASE_URL en el .env (cadena de conexión de Neon).');
  process.exit(1);
}
const { db, client } = createDb(target);
console.log(prod ? 'Base de datos: producción (Neon)' : 'Base de datos: local');

const rows = await db.select().from(questionBank);
const bad = rows.filter((r) => VETADAS.test(r.question) || VETADAS.test(r.reason));
for (const r of bad) console.log(`  ${r.domainId}/${r.probeId}: ${r.question} · ${r.reason}`);
for (const r of bad) await db.delete(questionBank).where(and(eq(questionBank.domainId, r.domainId), eq(questionBank.probeId, r.probeId), eq(questionBank.variant, r.variant)));
console.log(`${bad.length} de ${rows.length} variantes borradas; se redactan de nuevo al arrancar la API.`);
await client.end();
