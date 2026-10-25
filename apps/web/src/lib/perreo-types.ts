import type { Item } from './api'

/** Resumen de un artista del Modo Perreo (explorador). */
export interface PerreoArtist {
  slug: string
  name: string
  country: string | null
  city: string | null
  countries: string[]
  debutYear: number | null
  /** 0 = underground, 100 = mainstream. */
  fame: number
  styles: string[]
  labels: string[]
  /** La persona lo sigue en Instagram. */
  followed: boolean
  /** artist, group, producer, dj, label, composer, media, agency, other, unclassified. */
  kind: string
  /** Ficha mínima: por completar. */
  incomplete: boolean
  nickname?: string | null
  /** Huella de la foto: cambia cuando la foto cambia (null si no tiene). */
  photoV?: string | null
  aliases?: string[]
  /** «Nivel de calle» 0–100 (a mano). */
  streetLevel?: number | null
  status?: string | null
  /** Color propio #rrggbb (a mano o el de su foto). */
  color?: string | null
}

export interface PerreoFacets {
  countries: { value: string; count: number }[]
  cities: { value: string; count: number }[]
  eras: { value: string; label: string; count: number }[]
  labels: { value: string; count: number }[]
  styles: { value: string; count: number }[]
  kinds: { value: string; count: number }[]
}

export interface PerreoArtistList {
  artists: PerreoArtist[]
  total: number
  followedTotal: number
  facets: PerreoFacets
}

export interface PerreoArtistFull extends Omit<PerreoArtist, 'labels'> {
  realName: string | null
  birthDate: string | null
  listeners: number | null
  labels: { name: string; start: number | null; end: number | null }[]
  links: Partial<Record<LinkKey, string>>
  activeUntil?: number | null
  collaborators?: string[]
  youtubeChannelId?: string | null
  bio: string | null
  bioSource: string | null
  similar: string[]
  followed: boolean
  hidden?: boolean
  featuredVideoId?: string | null
  /** Campos editados a mano (las recargas no los pisan). */
  manualFields?: string[]
}

export interface PerreoArtistDetail {
  artist: PerreoArtistFull
  /** Sus canciones (la destacada, la primera) para elegir otra. */
  ownSongs: { videoId: string; title: string }[]
  similar: PerreoArtist[]
  /** De los parecidos, los que la persona sigue en Instagram. */
  alsoFollow: PerreoArtist[]
  /** Primera lista: sus canciones y las de sus parecidos. */
  firstList: Item[]
}

export type PerreoSort = 'fame' | 'age' | 'name'

/** Filtros del explorador; se convierten en la query de la API. */
export interface PerreoFilters {
  q: string
  sort: PerreoSort
  fameMin: number
  fameMax: number
  country: string
  city: string
  era: string
  label: string
  style: string
  /** Solo los que la persona sigue en Instagram. */
  followed: boolean
  kind: string
}

export const NO_FILTERS: PerreoFilters = { kind: '', followed: false, q: '', sort: 'fame', fameMin: 0, fameMax: 100, country: '', city: '', era: '', label: '', style: '' }

export const filtersToQuery = (f: PerreoFilters) => {
  const p = new URLSearchParams()
  p.set('sort', f.sort)
  if (f.q.trim()) p.set('q', f.q.trim())
  if (f.fameMin > 0) p.set('fameMin', String(f.fameMin))
  if (f.fameMax < 100) p.set('fameMax', String(f.fameMax))
  if (f.followed) p.set('followed', '1')
  if (f.kind) p.set('kind', f.kind)
  for (const k of ['country', 'city', 'era', 'label', 'style'] as const) if (f[k]) p.set(k, f[k])
  return p.toString()
}

/** Cuántos filtros (sin contar el orden) hay activos. */
export const activeFilterCount = (f: PerreoFilters) =>
  (f.q.trim() ? 1 : 0) + (f.followed ? 1 : 0) + (f.kind ? 1 : 0) + (f.fameMin > 0 || f.fameMax < 100 ? 1 : 0) + (['country', 'city', 'era', 'label', 'style'] as const).filter((k) => f[k]).length

/** Una cuenta dudosa de Instagram que espera tu decisión. */
export interface PerreoReviewItem {
  id: string
  name: string
  reason: string
  listeners: number | null
  tags: string[]
  mbid: string | null
  qid: string | null
}

export interface PerreoReview {
  pending: PerreoReviewItem[]
  accepted: number
  rejected: number
}

/** Tipos de cuenta, en el orden del contador. */
export const KIND_LABELS: Record<string, string> = {
  artist: 'artistas',
  group: 'dúos y grupos',
  producer: 'productores',
  dj: 'DJs',
  label: 'sellos',
  composer: 'compositores',
  media: 'medios',
  agency: 'mánagers y agencias',
  other: 'otros',
  unclassified: 'sin clasificar',
}
const SINGULAR: Record<string, string> = { artist: 'Artista', group: 'Dúo o grupo', producer: 'Productor', dj: 'DJ', label: 'Sello', composer: 'Compositor', media: 'Medio', agency: 'Mánager o agencia', other: 'Otro', unclassified: 'Sin clasificar' }
export const kindName = (kind: string) => SINGULAR[kind] ?? kind

/** «312 artistas · 140 productores · 48 sellos» (solo los tipos con alguien). */
export const kindCounter = (kinds: { value: string; count: number }[]) =>
  Object.keys(KIND_LABELS)
    .flatMap((k) => kinds.filter((x) => x.value === k && x.count > 0).map((x) => `${x.count} ${KIND_LABELS[k]}`))
    .join(' · ')

/** Redes y plataformas editables, en el orden del formulario. */
export const LINK_FIELDS = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@…' },
  { key: 'x', label: 'X (Twitter)', placeholder: 'https://x.com/…' },
  { key: 'youtubeMusic', label: 'YouTube', placeholder: 'https://music.youtube.com/…' },
  { key: 'spotify', label: 'Spotify', placeholder: 'https://open.spotify.com/…' },
  { key: 'appleMusic', label: 'Apple Music', placeholder: 'https://music.apple.com/…' },
  { key: 'soundcloud', label: 'SoundCloud', placeholder: 'https://soundcloud.com/…' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
  { key: 'web', label: 'Web oficial', placeholder: 'https://…' },
] as const
export type LinkKey = (typeof LINK_FIELDS)[number]['key']

/** Estado del artista. */
export const STATUS_LABELS: Record<string, string> = { active: 'En activo', hiatus: 'En pausa', retired: 'Retirado', deceased: 'Fallecido' }

/** Lo que se manda al editar un artista a mano (todo opcional). */
export interface PerreoArtistPatch {
  name?: string
  nickname?: string | null
  kind?: string
  country?: string | null
  city?: string | null
  debutYear?: number | null
  activeUntil?: number | null
  status?: string | null
  realName?: string | null
  birthDate?: string | null
  fame?: number
  streetLevel?: number | null
  listeners?: number | null
  aliases?: string[]
  collaborators?: string[]
  youtubeChannelId?: string | null
  color?: string | null
  styles?: string[]
  labels?: { name: string; start?: number | null; end?: number | null }[]
  bio?: string | null
  links?: Partial<Record<LinkKey, string>>
  photoUrl?: string
  photoData?: string
  featured?: string | null
  hidden?: boolean
}

/** Estilos sugeridos en el formulario. */
export const STYLE_OPTIONS = ['perreo', 'perreo old school', 'romántico', 'trap', 'trap latino', 'dembow', 'reparto', 'rkt', 'mambo', 'neoperreo', 'drill', 'dancehall', 'moombahton', 'cumbia villera', 'afrobeat', 'pop urbano', 'old school']
export const KIND_OPTIONS = Object.keys(KIND_LABELS)
