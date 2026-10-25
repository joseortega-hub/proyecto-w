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
  links: Partial<Record<'instagram' | 'tiktok' | 'x' | 'web' | 'spotify' | 'youtubeMusic' | 'appleMusic', string>>
  bio: string | null
  bioSource: string | null
  similar: string[]
  followed: boolean
}

export interface PerreoArtistDetail {
  artist: PerreoArtistFull
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
