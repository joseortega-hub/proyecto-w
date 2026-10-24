// Carga el Modo Perreo en la BD: pnpm perreo:load [--prod]
// Lee data/privado/perreo/ (lo genera pnpm perreo:import), aplica las migraciones pendientes, crea el
// dominio y guarda artistas (con su foto en base64), canciones y, si existen, sus embeddings locales.
// Con --prod usa PROD_DATABASE_URL del .env; sin él, la BD local. Se puede repetir sin duplicar.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { config } from '../config.js';
import { createDb } from '../db/client.js';
import { domains, perreoArtists, perreoReview } from '../db/schema.js';
import { perreoDomain } from '../domains/perreo.domain.js';
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
  const d = perreoDomain;
  const row = { id: d.id, name: d.name, itemNoun: d.itemNoun, itemNounPlural: d.itemNounPlural, config: d.config };
  await db.insert(domains).values(row).onConflictDoUpdate({ target: domains.id, set: row });

  for (const a of artists) {
    let photo: string | null = null;
    if (a.hasPhoto) photo = readFileSync(join(dir, 'photos', `${a.slug}.webp`)).toString('base64');
    const { hasPhoto: _h, ...fields } = a;
    const values = { ...fields, photo };
    await db.insert(perreoArtists).values(values).onConflictDoUpdate({ target: perreoArtists.slug, set: values });
  }
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
