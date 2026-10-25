// Edición a mano de un artista del Modo Perreo: validación, campos protegidos y utilidades sin red.
import { z } from 'zod';
import { KINDS } from './perreo.kinds.js';

const text = (max: number) => z.string().trim().max(max);
const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => /^https?:\/\//i.test(v), 'Tiene que ser un enlace http(s)');
const link = z.union([url, z.literal('')]);

/** Cuerpo del PATCH: todo opcional; `null` o '' vacían el campo. */
export const artistPatchSchema = z
  .object({
    name: text(80).min(1),
    nickname: text(80).nullable(),
    kind: z.enum(KINDS),
    country: text(80).nullable(),
    city: text(120).nullable(),
    debutYear: z.number().int().min(1900).max(2100).nullable(),
    styles: z.array(text(30).min(1)).max(12),
    labels: z.array(z.object({ name: text(80).min(1), start: z.number().int().nullable().optional(), end: z.number().int().nullable().optional() })).max(20),
    bio: text(2000).nullable(),
    links: z.object({ instagram: link, youtubeMusic: link, spotify: link }).partial(),
    /** Foto por enlace (el servidor la descarga y la pasa a WebP) o archivo ya reducido en base64. */
    photoUrl: url,
    photoData: z.string().max(600_000).regex(/^[A-Za-z0-9+/=]+$/, 'Imagen no válida'),
    /** Enlace de YouTube o id de 11 caracteres. */
    featured: z.union([text(300).min(11), z.null()]),
    hidden: z.boolean(),
  })
  .partial()
  .strict();
export type ArtistPatch = z.infer<typeof artistPatchSchema>;

/** Campos editados a mano → columnas de la BD que `perreo:load` no debe pisar. */
export const MANUAL_COLUMNS: Record<string, string[]> = {
  name: ['name'],
  kind: ['kind', 'incomplete'],
  country: ['country', 'city', 'countries'],
  debutYear: ['debutYear'],
  styles: ['styles'],
  labels: ['labels'],
  bio: ['bio', 'bioSource'],
  links: ['links'],
  photo: ['photo'],
  nickname: ['nickname'],
};

/** Quita de `values` lo que se editó a mano. Sin lista, no quita nada. */
export function protectManual<T extends Record<string, unknown>>(values: T, manual: readonly string[] | undefined): Partial<T> {
  const blocked = new Set((manual ?? []).flatMap((k) => MANUAL_COLUMNS[k] ?? []));
  return Object.fromEntries(Object.entries(values).filter(([k]) => !blocked.has(k))) as Partial<T>;
}

/** Id de vídeo a partir de un enlace de YouTube / YouTube Music / youtu.be / shorts, o del propio id. */
export function youtubeId(input: string): string | null {
  const v = input.trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  try {
    const u = new URL(v);
    const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
    if (host === 'youtu.be') return /^[\w-]{11}$/.test(u.pathname.slice(1, 12)) ? u.pathname.slice(1, 12) : null;
    if (host === 'youtube.com') {
      const id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1] ?? null;
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch {
    /* no es un enlace */
  }
  return null;
}

/** ¿Es una IP o nombre de red privada? (evita que la descarga de la foto llegue a la red interna). */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.includes(':')) return h === '::1' || h === '::' || /^f[cd]/.test(h) || h.startsWith('fe80') || h.startsWith('::ffff:');
  const m = h.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

interface CurrentArtist {
  name: string;
  nickname: string | null;
  kind: string;
  country: string | null;
  city: string | null;
  debutYear: number | null;
  styles: string[];
  labels: { name: string; start: number | null; end: number | null }[];
  bio: string | null;
  links: Record<string, string>;
  manualFields: string[];
}

/** Qué columnas cambian (solo las que de verdad cambian) y qué campos pasan a ser manuales. La foto y la canción destacada se tratan aparte. */
export function planEdit(cur: CurrentArtist, patch: ArtistPatch): { set: Record<string, unknown>; manual: Set<string> } {
  const set: Record<string, unknown> = {};
  const manual = new Set(cur.manualFields);
  const blank = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
  const change = (key: string, cols: Record<string, unknown>) => {
    Object.assign(set, cols);
    manual.add(key);
  };
  if (patch.name !== undefined && patch.name !== cur.name) change('name', { name: patch.name });
  if (patch.nickname !== undefined && blank(patch.nickname) !== cur.nickname) change('nickname', { nickname: blank(patch.nickname) });
  if (patch.kind !== undefined && patch.kind !== cur.kind) change('kind', { kind: patch.kind });
  const country = patch.country === undefined ? cur.country : blank(patch.country);
  const city = patch.city === undefined ? cur.city : blank(patch.city);
  if (country !== cur.country || city !== cur.city) change('country', { country, city, ...(country !== cur.country ? { countries: country ? [country] : [] } : {}) });
  if (patch.debutYear !== undefined && patch.debutYear !== cur.debutYear) change('debutYear', { debutYear: patch.debutYear });
  if (patch.styles) {
    const styles = [...new Set(patch.styles.map((x) => x.toLowerCase()))];
    if (styles.join('|') !== cur.styles.join('|')) change('styles', { styles });
  }
  if (patch.labels) {
    const labels = patch.labels.map((l) => ({ name: l.name, start: l.start ?? null, end: l.end ?? null }));
    if (JSON.stringify(labels) !== JSON.stringify(cur.labels)) change('labels', { labels });
  }
  if (patch.bio !== undefined && blank(patch.bio) !== cur.bio) change('bio', { bio: blank(patch.bio), bioSource: blank(patch.bio) ? 'Editado a mano' : null });
  if (patch.links) {
    const links = { ...cur.links };
    for (const [k, v] of Object.entries(patch.links)) {
      if (v) links[k] = v;
      else delete links[k];
    }
    if (JSON.stringify(links) !== JSON.stringify(cur.links)) change('links', { links });
  }
  if (patch.hidden !== undefined) set.hidden = patch.hidden;
  // Si lo estás corrigiendo a mano, deja de ser una ficha «por completar».
  if (Object.keys(set).some((k) => k !== 'hidden')) set.incomplete = false;
  return { set, manual };
}
