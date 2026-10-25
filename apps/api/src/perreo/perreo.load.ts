// Carga el Modo Perreo en la BD: pnpm perreo:load [--prod]
// Lee data/privado/perreo/ (lo genera pnpm perreo:import), aplica las migraciones pendientes, crea el
// dominio y guarda artistas (con su foto en base64), canciones y, si existen, sus embeddings locales.
// Con --prod usa PROD_DATABASE_URL del .env; sin él, la BD local. Se puede repetir sin duplicar.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { domains, perreoArtists, perreoReview } from '../db/schema.js';
import { perreoDomain } from '../domains/perreo.domain.js';
import { protectManual } from './perreo.edit.js';
import { upsertItems } from '../catalog/upsert.js';
import { mergePerreo } from './perreo.resolve.js';
import type { IgReview, PerreoArtistFile, PerreoOverlay, PerreoSongFile } from './perreo.types.js';

const prod = process.argv.includes('--prod');
const target = prod ? process.env.PROD_DATABASE_URL?.trim() : undefined;
if (prod && !target) {
  console.error('Falta PROD_DATABASE_URL en el .env (cadena de conexión de Neon).');
  process.exit(1);
}
console.log(prod ? 'Base de datos: producción (Neon)' : 'Base de datos: local');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
const dir = join(root, 'data', 'privado', 'perreo');
const readJson = <T>(file: string, fallback: T): T => {
  try {
    return JSON.parse(readFileSync(join(dir, file), 'utf8')) as T;
  } catch {
    return fallback;
  }
};
const artists = mergePerreo(
  readJson<PerreoArtistFile[]>('artists.json', []),
  readJson<PerreoArtistFile[]>('ig-artists.json', []),
  readJson<Record<string, PerreoOverlay>>('ig-overlay.json', {}),
);
const songs = [...readJson<PerreoSongFile[]>('songs.json', []), ...readJson<PerreoSongFile[]>('ig-songs.json', [])];
const reviewFile = readJson<IgReview[]>('ig-review.json', []);
if (!songs.length) console.warn('Sin canciones: se cargan solo los artistas.');

const { db, client } = createDb(target ?? config.databaseUrl);
try {
  await migrate(db, { migrationsFolder: resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle') });
  // Comprobación previa: si una migración no se aplicó, se dice claro en vez de fallar en el insert.
  const cols = await client<{ column_name: string }[]>`select column_name from information_schema.columns where table_name = 'perreo_artists'`;
  const missing = ['source', 'followed', 'kind', 'incomplete', 'nickname', 'hidden', 'featured_video_id', 'manual_fields', 'street_level', 'status', 'active_until', 'aliases', 'collaborators', 'color'].filter((c) => !cols.some((x) => x.column_name === c));
  if (missing.length) throw new Error(`Faltan columnas en perreo_artists (${missing.join(', ')}): la migración no se aplicó. Haz git pull y repite el comando; si sigue, revisa que drizzle/meta/_journal.json incluya 0020_perreo_fields.`);
  const d = perreoDomain;
  const row = { id: d.id, name: d.name, itemNoun: d.itemNoun, itemNounPlural: d.itemNounPlural, config: d.config };
  await db.insert(domains).values(row).onConflictDoUpdate({ target: domains.id, set: row });

  // Lo editado a mano (manual_fields) no se pisa; `hidden`, `nickname` y la canción destacada no vienen en los ficheros.
  const manualBy = new Map((await db.select({ slug: perreoArtists.slug, manual: perreoArtists.manualFields }).from(perreoArtists)).map((r) => [r.slug, r.manual]));
  for (const a of artists) {
    const manual = manualBy.get(a.slug);
    let photo: string | null = null;
    if (a.hasPhoto && !manual?.includes('photo')) photo = readFileSync(join(dir, 'photos', `${a.slug}.webp`)).toString('base64');
    const { hasPhoto: _h, ...fields } = a;
    // Con foto nueva, el color se vuelve a sacar de ella (la API lo calcula al pedirlo), salvo si es tuyo.
    const values = { ...fields, photo, ...(photo ? { color: null } : {}) };
    await db.insert(perreoArtists).values(values).onConflictDoUpdate({ target: perreoArtists.slug, set: protectManual(values, manual) });
  }
  // Solo los lotes ya procesados: lo de Instagram que ya no esté en los ficheros se quita.
  // (los editados a mano se quedan aunque salgan de los ficheros)
  await db.delete(perreoArtists).where(and(eq(perreoArtists.source, 'instagram'), notInArray(perreoArtists.slug, artists.map((a) => a.slug)), sql`cardinality(${perreoArtists.manualFields}) = 0`));
  console.log(`Artistas: ${artists.length} (${artists.filter((a) => a.followed).length} que sigues en Instagram)`);

  // Dudosas de la segunda pasada: la decisión que ya tomaste en la pantalla se conserva.
  const pending = reviewFile.filter((r) => !artists.some((a) => a.links.instagram?.toLowerCase().endsWith('/' + r.id)));
  if (pending.length) await db.insert(perreoReview).values(pending).onConflictDoNothing();
  console.log(`Por revisar: ${pending.length} cuentas`);

  // Un mismo vídeo puede salir en dos artistas (colaboraciones): se queda con el más popular.
  const unique = [...new Map(songs.sort((a, b) => a.popularity - b.popularity).map((s) => [s.videoId, s])).values()];
  if (unique.length) {
    const ids = await upsertItems(
      db,
      perreoDomain.id,
      unique.map((s) => ({
        source: 'youtube',
        externalId: s.videoId,
        ownerId: '',
        title: s.title,
        subtitle: s.artistName,
        description: null,
        imageUrl: `https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`,
        mediaUrl: `https://www.youtube.com/watch?v=${s.videoId}`,
        externalUrl: `https://music.youtube.com/watch?v=${s.videoId}`,
        durationSec: s.durationSec ?? null,
        attributes: s.attributes ?? {},
        tags: s.tags ?? [],
        facets: { artist: s.artistSlug, ...(s.language ? { language: s.language } : {}) },
        popularity: s.popularity,
        details: {},
      })),
    );
    const pending = unique.filter((s) => !s.attributes).length;
    console.log(`Canciones: ${ids.length}${pending ? ` (${pending} sin analizar: repite pnpm perreo:import o pnpm perreo:instagram:import)` : ''}`);
  }
} finally {
  await client.end();
}
