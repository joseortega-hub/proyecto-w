// Artistas de tu «Mi YouTube» que aún no están en el Modo Perreo: pnpm perreo:youtube [--prod] [--limit 80]
// Lee de la BD las canciones de «Mi YouTube» de quien tiene el modo desbloqueado (con --prod, PROD_DATABASE_URL)
// y saca los artistas (y colaboradores) sin ficha, los de más temas y 👍 primero. Cada uno pasa por Last.fm con el
// mismo criterio que la segunda pasada de Instagram (nombre exacto + género urbano y oyentes): los seguros entran
// en instagram.json como `yt:<clave>` (fichas «de tu YouTube») y los dudosos en ig-review.json («Por revisar»).
// Reanudable (yt-done.json). Todo en data/privado/perreo/. Después: pnpm perreo:instagram:import y pnpm perreo:load --prod.
// También dice qué artistas con ficha pesan más en tu YouTube y aún no están en favoritos.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { perreoArtists, perreoReview } from '../db/schema.js';
import { classify } from './perreo.resolve.js';
import { lastfmSearch } from './perreo.sources.ig.js';
import type { IgArtist, IgReview } from './perreo.types.js';
import { buildArtistIndex, linkSongs, rankSaved, unmatchedArtists } from './perreo.youtube.js';
import { savedYouTube } from './perreo.youtube.data.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
const dir = join(root, 'data', 'privado', 'perreo');
mkdirSync(dir, { recursive: true });
const read = <T>(file: string, fallback: T): T => (existsSync(join(dir, file)) ? (JSON.parse(readFileSync(join(dir, file), 'utf8')) as T) : fallback);
const write = (file: string, data: unknown) => writeFileSync(join(dir, file), JSON.stringify(data, null, 1));

const argv = process.argv.slice(2);
const prod = argv.includes('--prod');
const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) || 80 : 80;
const target = prod ? process.env.PROD_DATABASE_URL?.trim() : undefined;
if (prod && !target) throw new Error('Falta PROD_DATABASE_URL en el .env.');
const lastfmKey = config.lastfmApiKey;
if (!lastfmKey) throw new Error('Falta LASTFM_API_KEY en el .env.');

const confirmed = new Map(read<IgArtist[]>('instagram.json', []).map((a) => [a.instagram.toLowerCase(), a]));
const review = new Map(read<IgReview[]>('ig-review.json', []).map((r) => [r.id, r]));
const rejected = new Set(read<string[]>('ig-rejected.json', []));
const done = new Set(read<string[]>('yt-done.json', []));

const { db, client } = createDb(target ?? config.databaseUrl);
try {
  const artists = await db.select({ slug: perreoArtists.slug, name: perreoArtists.name, aliases: perreoArtists.aliases, favoriteRank: perreoArtists.favoriteRank }).from(perreoArtists);
  // Lo que ya está en la BD, en los ficheros o en «Por revisar» (también lo ya decidido) no se vuelve a mirar.
  const decided = await db.select({ id: perreoReview.id, name: perreoReview.name }).from(perreoReview);
  const index = buildArtistIndex([
    ...artists,
    ...[...confirmed.values()].map((a) => ({ slug: a.instagram, name: a.name, aliases: [] })),
    ...[...review.values(), ...decided].map((r) => ({ slug: r.id, name: r.name, aliases: [] })),
  ]);
  const { songs, likes } = await savedYouTube(db);
  console.log(`Tu YouTube: ${songs.length} canciones (${Object.values(likes).filter((v) => v === 'up').length} con 👍) · ${prod ? 'producción' : 'local'}`);

  const missing = unmatchedArtists(songs, index, likes).filter((m) => !done.has(m.key) && !rejected.has(`yt:${m.key}`));
  const batch = missing.slice(0, limit);
  console.log(`Artistas sin ficha: ${missing.length}; este paso mira ${batch.length} en Last.fm`);
  let sure = 0;
  let doubtful = 0;
  for (const m of batch) {
    const hits = m.name.length >= 2 ? await lastfmSearch(m.name, lastfmKey, 3) : [];
    const verdicts = hits.map((c) => ({ c, v: classify(m.name, { name: c.name, listeners: c.listeners, tags: c.tags }) })).filter((x) => x.v);
    const best = verdicts.find((x) => x.v!.kind === 'sure') ?? verdicts[0];
    const id = `yt:${m.key}`;
    if (best?.v?.kind === 'sure') {
      confirmed.set(id, { name: best.c.name, instagram: id, mbid: best.c.mbid, via: 'youtube' });
      sure++;
      console.log(`  ✓ ${best.c.name} (${m.songs} temas · ${best.v.reason})`);
    } else if (best?.v) {
      review.set(id, { id, name: best.c.name, reason: `De tu YouTube (${m.songs} temas): ${best.v.reason}`, listeners: best.c.listeners, tags: best.c.tags.slice(0, 8), mbid: best.c.mbid, qid: null });
      doubtful++;
      console.log(`  ? ${best.c.name} → Por revisar (${best.v.reason})`);
    }
    done.add(m.key);
  }
  write('instagram.json', [...confirmed.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')));
  write('ig-review.json', [...review.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')));
  write('yt-done.json', [...done]);
  console.log(`Fichas nuevas de tu YouTube: ${sure} · por revisar: ${doubtful}${missing.length > batch.length ? ` · quedan ${missing.length - batch.length}: repite el comando` : ''}`);

  // Señal para favoritos: los que más pesan en tu YouTube (temas y 👍) y aún no están en favoritos.json.
  const { bySlug } = linkSongs(songs.map((s) => ({ ...s, videoId: s.externalId })), buildArtistIndex(artists));
  const names = new Map(artists.map((a) => [a.slug, a]));
  const candidates = rankSaved(bySlug, likes).filter((r) => names.get(r.slug)?.favoriteRank == null).slice(0, 10);
  if (candidates.length) {
    console.log('\nCandidatos a favoritos (añádelos a data/privado/perreo/favoritos.json si quieres):');
    for (const r of candidates) console.log(`  ${names.get(r.slug)!.name} (${r.slug}): ${r.count} temas${r.likes ? `, ${r.likes} 👍` : ''}`);
  }
  console.log(`\nDespués: pnpm perreo:instagram:import y pnpm perreo:load${prod ? ' --prod' : ''}`);
} finally {
  await client.end();
}
