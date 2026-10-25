// Artistas entre tus seguidos de Instagram: pnpm perreo:instagram [--apply-review [--prod]]
// Lee tu exportación oficial (data/privado/following.json, ignorada por Git) y la pasa por dos filtros:
//  1) Wikidata: usuario de Instagram (P2003) de un músico.
//  2) Segunda pasada con las cuentas que faltan: MusicBrainz (el enlace de Instagram coincide) y Last.fm
//     (nombre exacto + género urbano o latino). Las dudosas van a la pantalla «Por revisar» del Modo Perreo.
// Solo se guardan artistas (instagram.json) y dudosas (ig-review.json); del resto de cuentas queda un hash, no el
// nombre, para poder reanudar. Todo en data/privado/perreo/ (ignorado por Git). Después: pnpm perreo:instagram:import.
//
// --apply-review [--prod]: trae de la BD las decisiones que has tomado en la pantalla «Por revisar»
// (aceptadas → instagram.json, descartadas → ig-rejected.json) para que la siguiente importación las use.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inArray } from 'drizzle-orm';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { perreoReview } from '../db/schema.js';
import type { IgArtist, IgReview } from './perreo.types.js';
import { accountHash, classify, searchName, type Candidate } from './perreo.resolve.js';
import { kindFromMusicBrainz, kindFromUsername } from './perreo.kinds.js';
import { lastfmSearch, musicbrainzByInstagram, musicbrainzByName } from './perreo.sources.ig.js';
import { sparql, usernames } from './perreo.instagram.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
const dir = join(root, 'data', 'privado', 'perreo');
const input = join(root, 'data', 'privado', 'following.json');
mkdirSync(dir, { recursive: true });
const read = <T>(file: string, fallback: T): T => (existsSync(join(dir, file)) ? (JSON.parse(readFileSync(join(dir, file), 'utf8')) as T) : fallback);
const write = (file: string, data: unknown) => writeFileSync(join(dir, file), JSON.stringify(data, null, 1));


const confirmed = new Map(read<IgArtist[]>('instagram.json', []).map((a) => [a.instagram.toLowerCase(), a]));
const review = new Map(read<IgReview[]>('ig-review.json', []).map((r) => [r.id, r]));
const rejected = new Set(read<string[]>('ig-rejected.json', []));
const done = new Set(read<string[]>('ig-done.json', []));

const argv = process.argv.slice(2);
const flag = (name: string) => (argv.includes(name) ? Number(argv[argv.indexOf(name) + 1]) : undefined);
export const BATCH_SIZE = 300;
const allUsers = usernames(JSON.parse(readFileSync(input, 'utf8')));
const batchOf = (user: string) => Math.floor(Math.max(0, allUsers.findIndex((u) => u.toLowerCase() === user.toLowerCase())) / BATCH_SIZE) + 1;
// Lotes: --batch 1 (cuentas 1-300), --batch 2 (301-600)… o --from/--limit. Sin nada, todas.
const batch = flag('--batch');
const from = batch ? (batch - 1) * BATCH_SIZE : (flag('--from') ?? 0);
const limit = batch ? BATCH_SIZE : (flag('--limit') ?? allUsers.length);
const users = allUsers.slice(from, from + limit);
for (const a of confirmed.values()) a.batch = batchOf(a.instagram);

if (process.argv.includes('--apply-review')) {
  const prod = process.argv.includes('--prod');
  const target = prod ? process.env.PROD_DATABASE_URL?.trim() : undefined;
  if (prod && !target) throw new Error('Falta PROD_DATABASE_URL en el .env.');
  const { db, client } = createDb(target ?? config.databaseUrl);
  try {
    const rows = await db.select().from(perreoReview).where(inArray(perreoReview.status, ['accepted', 'rejected']));
    for (const r of rows) {
      review.delete(r.id);
      if (r.status === 'accepted') confirmed.set(r.id, { name: r.name, instagram: r.id, wikidata: r.qid, mbid: r.mbid, via: 'revisado', batch: batchOf(r.id) });
      else rejected.add(r.id);
    }
    console.log(`Revisión aplicada: ${rows.filter((r) => r.status === 'accepted').length} aceptadas, ${rows.filter((r) => r.status === 'rejected').length} descartadas (${prod ? 'producción' : 'local'}).`);
  } finally {
    await client.end();
  }
  save();
  process.exit(0);
}

function save() {
  write('instagram.json', [...confirmed.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')));
  write('ig-review.json', [...review.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')));
  write('ig-rejected.json', [...rejected]);
  write('ig-done.json', [...done]);
}

console.log(`Seguidos: ${allUsers.length} cuentas; este paso mira ${users.length} (cuentas ${from + 1}-${from + users.length})`);

// ---------- Pasada 1: Wikidata ----------
for (let i = 0; i < users.length; i += 150) {
  const res = await fetch('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/sparql-results+json', 'user-agent': 'Sintonia/0.1 (easter egg educativo)' },
    body: new URLSearchParams({ query: sparql(users.slice(i, i + 150)) }),
  });
  if (!res.ok) throw new Error(`Wikidata respondió ${res.status}`);
  const body = (await res.json()) as { results: { bindings: { item: { value: string }; itemLabel: { value: string }; ig: { value: string } }[] } };
  for (const b of body.results.bindings) {
    const key = b.ig.value.toLowerCase();
    if (!rejected.has(key)) confirmed.set(key, { ...confirmed.get(key), name: b.itemLabel.value, instagram: b.ig.value, wikidata: b.item.value.split('/').pop()!, via: 'wikidata', batch: batchOf(key) });
    review.delete(key);
  }
}
console.log(`Pasada 1 (Wikidata): ${confirmed.size} artistas`);
save();

// ---------- Pasada 2: MusicBrainz y Last.fm con las cuentas que faltan ----------
const lastfmKey = config.lastfmApiKey;
const todo = users.filter((u) => !confirmed.has(u.toLowerCase()) && !review.has(u.toLowerCase()) && !rejected.has(u.toLowerCase()) && !done.has(accountHash(u)));
console.log(`Pasada 2: ${todo.length} cuentas por mirar (MusicBrainz va a 1 por segundo; se puede cortar y repetir)`);
let n = 0;
for (const user of todo) {
  n++;
  const lower = user.toLowerCase();
  try {
    const mb = await musicbrainzByInstagram(lower);
    if (mb) {
      confirmed.set(lower, { name: mb.name, instagram: user, wikidata: mb.qid, mbid: mb.mbid, via: 'musicbrainz', kind: kindFromMusicBrainz(mb.type), batch: batchOf(user) });
      console.log(`  ✓ ${user} → ${mb.name} (enlace de MusicBrainz)`);
    } else if (lastfmKey) {
      const guess = searchName(user);
      const hits = guess.length >= 3 ? await lastfmSearch(guess, lastfmKey, 3) : [];
      for (const hit of hits) {
        const candidate: Candidate = { name: hit.name, listeners: hit.listeners, tags: hit.tags };
        let verdict = classify(user, candidate);
        if (!verdict) continue;
        // El nombre cuadra: MusicBrainz confirma el enlace de Instagram, el MBID y los géneros.
        const mbs = await musicbrainzByName(hit.name, 1);
        const found = mbs.find((m) => m.instagram.includes(lower));
        if (found) verdict = classify(user, { ...candidate, linkMatch: true })!;
        const best = found ?? mbs[0];
        const mbid = best?.mbid ?? hit.mbid ?? null;
        const qid = best?.qid ?? null;
        if (verdict.kind === 'sure') {
          confirmed.set(lower, { name: hit.name, instagram: user, wikidata: qid, mbid, via: found ? 'musicbrainz' : 'lastfm', kind: kindFromMusicBrainz(best?.type), batch: batchOf(user) });
          console.log(`  ✓ ${user} → ${hit.name} (${verdict.reason})`);
        } else {
          review.set(lower, { id: lower, name: hit.name, reason: verdict.reason, listeners: hit.listeners, tags: hit.tags.slice(0, 5), mbid, qid });
          console.log(`  ? ${user} → ${hit.name} (${verdict.reason})`);
        }
        break;
      }
    }
  } catch (error) {
    console.warn(`  ${user}: ${(error as Error).message.slice(0, 80)}; sigo`);
    continue;
  }
  done.add(accountHash(user));
  if (n % 15 === 0) {
    save();
    console.log(`  ${n}/${todo.length} · ${confirmed.size} artistas · ${review.size} por revisar`);
  }
}
// Lo que no se pudo resolver entra igual como ficha mínima (nombre de usuario, tipo por pistas del usuario, «por completar»), sin inventar datos.
for (const user of users) {
  const key = user.toLowerCase();
  if (confirmed.has(key) || review.has(key) || rejected.has(key)) continue;
  confirmed.set(key, { name: user, instagram: user, via: 'sin-resolver', kind: kindFromUsername(user), batch: batchOf(user) });
}
save();
console.log(`Listo: ${confirmed.size} artistas seguros, ${review.size} por revisar → ${dir}`);
