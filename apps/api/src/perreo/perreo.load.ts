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
import { domains, perreoArtists } from '../db/schema.js';
import { perreoDomain } from '../domains/perreo.domain.js';
import { upsertItems } from '../catalog/upsert.js';
import type { PerreoArtistFile, PerreoSongFile } from './perreo.types.js';

const prod = process.argv.includes('--prod');
const target = prod ? process.env.PROD_DATABASE_URL?.trim() : undefined;
if (prod && !target) {
  console.error('Falta PROD_DATABASE_URL en el .env (cadena de conexión de Neon).');
  process.exit(1);
}
console.log(prod ? 'Base de datos: producción (Neon)' : 'Base de datos: local');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../');
const dir = join(root, 'data', 'privado', 'perreo');
const artists = JSON.parse(readFileSync(join(dir, 'artists.json'), 'utf8')) as PerreoArtistFile[];
let songs: PerreoSongFile[] = [];
try {
  songs = JSON.parse(readFileSync(join(dir, 'songs.json'), 'utf8')) as PerreoSongFile[];
} catch {
  console.warn('Sin songs.json: se cargan solo los artistas.');
}

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
  console.log(`Artistas: ${artists.length}`);

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
    console.log(`Canciones: ${ids.length}${pending ? ` (${pending} sin analizar: repite pnpm perreo:import)` : ''}`);
  }
} finally {
  await client.end();
}
