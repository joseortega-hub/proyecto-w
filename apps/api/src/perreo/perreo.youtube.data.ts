import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { items, perreoUnlocks, tasteProfiles } from '../db/schema.js';
import { youtubeDomain } from '../domains/youtube.domain.js';
import type { Likes } from './perreo.youtube.js';

const savedColumns = {
  id: items.id,
  externalId: items.externalId,
  title: items.title,
  subtitle: items.subtitle,
  durationSec: items.durationSec,
  attributes: items.attributes,
  tags: items.tags,
  facets: items.facets,
};

/**
 * Canciones de «Mi YouTube» y sus 👍/👎 de quien tiene el Modo Perreo desbloqueado (o solo de `userId`).
 * Para los scripts y la API: nadie más ve las canciones de otra persona; lo que se saca de aquí son artistas y vídeos públicos.
 */
export async function savedYouTube(db: Db, userId?: string) {
  const owners = userId ? [userId] : (await db.select({ id: perreoUnlocks.userId }).from(perreoUnlocks)).map((r) => r.id);
  if (!owners.length) return { songs: [], likes: {} as Likes };
  const [songs, likes] = await Promise.all([
    db.select(savedColumns).from(items).where(and(eq(items.domainId, youtubeDomain.id), inArray(items.ownerId, owners))),
    youtubeLikes(db, owners),
  ]);
  return { songs, likes };
}

/** 👍/👎 en «Mi YouTube» de esas personas. */
export async function youtubeLikes(db: Db, owners: string[]): Promise<Likes> {
  const profiles = await db
    .select({ feedback: tasteProfiles.feedback })
    .from(tasteProfiles)
    .where(and(eq(tasteProfiles.domainId, youtubeDomain.id), inArray(tasteProfiles.userId, owners)));
  return Object.assign({}, ...profiles.map((p) => p.feedback));
}
