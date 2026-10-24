import { politeFetcher } from './derive.js';
import { compactDetails, type ItemDetails } from './item-details.js';

const BASE = 'https://musicbrainz.org/ws/2';
/** MusicBrainz exige un User-Agent que identifique la app y permite 1 petición por segundo. */
const USER_AGENT = 'Sintonia/0.1 (https://github.com/joseortega-hub/proyecto-w)';
const get = politeFetcher({ minIntervalMs: 1100, name: 'MusicBrainz', headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });

interface MbRelation {
  type: string;
  artist?: { name: string };
  work?: { relations?: MbRelation[] };
}
interface MbRecording {
  id: string;
  title: string;
  'artist-credit'?: { name: string; joinphrase?: string; artist?: { name: string } }[];
  relations?: MbRelation[];
  releases?: { title: string; date?: string; status?: string; 'release-group'?: { 'primary-type'?: string; 'secondary-types'?: string[] } }[];
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const uniq = (names: (string | undefined)[], exclude: string[] = []) => {
  const skip = new Set(exclude.map(norm));
  return [...new Set(names.filter((n): n is string => !!n && !skip.has(norm(n))))].slice(0, 6);
};

/** El álbum de verdad (el más antiguo): se descartan recopilatorios, directos y bandas sonoras. */
function pickRelease(releases: NonNullable<MbRecording['releases']>) {
  const rank = (r: (typeof releases)[number]) => {
    const group = r['release-group'];
    if (group?.['secondary-types']?.length) return 9;
    return ({ Album: 0, EP: 1, Single: 2 } as Record<string, number>)[group?.['primary-type'] ?? ''] ?? 5;
  };
  const dated = releases.filter((r) => r.date && r.status !== 'Bootleg');
  const best = Math.min(...dated.map(rank));
  return dated.filter((r) => rank(r) === best && best < 9).sort((a, b) => a.date!.localeCompare(b.date!))[0];
}

/** Créditos de una grabación de MusicBrainz → detalles. Función pura, sin red. */
export function parseRecording(rec: MbRecording, mainArtist: string): ItemDetails {
  const rels = rec.relations ?? [];
  const byType = (types: string[], list: MbRelation[]) => list.filter((r) => types.includes(r.type)).map((r) => r.artist?.name);
  const workRels = rels.flatMap((r) => r.work?.relations ?? []);
  const credit = rec['artist-credit'] ?? [];
  // Las colaboraciones son los artistas acreditados además del principal.
  const credited = credit.map((c) => c.artist?.name ?? c.name);
  const release = pickRelease(rec.releases ?? []);
  return compactDetails({
    producers: uniq(byType(['producer', 'co-producer'], rels)),
    composers: uniq(byType(['composer', 'writer'], workRels)),
    lyricists: uniq(byType(['lyricist'], workRels)),
    featured: uniq(credited, [mainArtist]),
    album: release?.title,
    year: Number(release?.date?.slice(0, 4)) || undefined,
  });
}

/** Busca la grabación (título + artista) y devuelve sus créditos; `null` si no hay coincidencia clara. */
export async function lookupCredits(title: string, artist: string | null): Promise<{ mbid: string; details: ItemDetails } | null> {
  const q = (s: string) => s.replace(/["\\]/g, '\\&');
  const query = `recording:"${q(title)}"${artist ? ` AND artist:"${q(artist)}"` : ''}`;
  const found = await get<{ recordings?: (MbRecording & { score?: number })[] }>(`${BASE}/recording?${new URLSearchParams({ query, limit: '5', fmt: 'json' })}`);
  const hit = found.recordings?.find((r) => (r.score ?? 0) >= 90 && norm(r.title) === norm(title));
  if (!hit) return null;
  const rec = await get<MbRecording>(`${BASE}/recording/${hit.id}?${new URLSearchParams({ inc: 'artist-credits+artists+releases+release-groups+artist-rels+work-rels+work-level-rels', fmt: 'json' })}`);
  return { mbid: hit.id, details: parseRecording(rec, artist ?? '') };
}
