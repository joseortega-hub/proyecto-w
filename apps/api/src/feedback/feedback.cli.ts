// Buzón de comentarios desde el PC: pnpm feedback [--prod] [--all] [--done <id>] [--keep-new]
// - Lista los pendientes (nuevos y leídos, no hechos) con su texto y guarda sus imágenes en
//   data/privado/buzon/<fecha>_<id>/ (ignorado por Git), más un resumen en pendientes.md.
// - Los nuevos pasan a «leído» al listarlos (salvo --keep-new). --all incluye los hechos.
// - --done <id> (o el principio del id) marca un comentario como hecho.
// Con --prod lee la BD de producción (PROD_DATABASE_URL del .env); sin él, la local.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { createDb } from '../db/client.js';
import { feedback } from '../db/schema.js';
import { folderName, formatFeedback, imageFileName } from './feedback.format.js';

const args = process.argv.slice(2);
const prod = args.includes('--prod');
const target = prod ? process.env.PROD_DATABASE_URL?.trim() : undefined;
if (prod && !target) {
  console.error('Falta PROD_DATABASE_URL en el .env (cadena de conexión de Neon).');
  process.exit(1);
}
const doneArg = args.includes('--done') ? args[args.indexOf('--done') + 1] : undefined;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const inbox = join(root, 'data/privado/buzon');
/** Rutas con «/» también en Windows, para leerlas igual desde cualquier PC. */
const posix = (path: string) => path.split(sep).join('/');

const { db, client } = createDb(target);
console.log(prod ? 'Buzón: producción (Neon)' : 'Buzón: local');

try {
  if (doneArg !== undefined) {
    if (!/^[0-9a-f-]{4,36}$/i.test(doneArg)) throw new Error('Uso: pnpm feedback --done <id o principio del id>');
    const rows = await db
      .update(feedback)
      .set({ status: 'done', updatedAt: new Date() })
      .where(sql`${feedback.id}::text like ${doneArg.toLowerCase() + '%'}`)
      .returning({ id: feedback.id });
    if (rows.length !== 1) console.log(rows.length ? `Ojo: ese principio coincide con ${rows.length} comentarios; marcados todos.` : 'No hay ningún comentario con ese id.');
    else console.log(`Hecho: ${rows[0].id}`);
  } else {
    const statuses = args.includes('--all') ? ['new', 'read', 'done'] : ['new', 'read'];
    const rows = await db.select().from(feedback).where(inArray(feedback.status, statuses)).orderBy(desc(feedback.createdAt)).limit(200);
    if (!rows.length) console.log('No hay comentarios pendientes.');
    const blocks: string[] = [];
    for (const row of rows) {
      const dir = join(inbox, folderName(row));
      const paths = row.images.map((image, i) => {
        mkdirSync(dir, { recursive: true });
        const file = join(dir, imageFileName(image, i));
        writeFileSync(file, Buffer.from(image.data, 'base64'));
        return posix(relative(root, file));
      });
      blocks.push(formatFeedback(row, paths));
    }
    if (rows.length) {
      const summary = `# Buzón de Sintonía (${prod ? 'producción' : 'local'}): ${rows.length} pendientes\n\n${blocks.join('\n\n---\n\n')}\n`;
      mkdirSync(inbox, { recursive: true });
      writeFileSync(join(inbox, 'pendientes.md'), summary);
      console.log(`\n${summary}`);
      console.log(`Resumen e imágenes en ${posix(relative(root, inbox))}/`);
      const fresh = rows.filter((r) => r.status === 'new').map((r) => r.id);
      if (fresh.length && !args.includes('--keep-new')) {
        await db.update(feedback).set({ status: 'read', updatedAt: new Date() }).where(and(inArray(feedback.id, fresh), eq(feedback.status, 'new')));
        console.log(`${fresh.length} nuevos marcados como leídos. Al terminar uno: pnpm feedback${prod ? ' --prod' : ''} --done <id>`);
      }
    }
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await client.end();
}
