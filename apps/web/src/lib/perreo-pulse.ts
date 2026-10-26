// «El pulso» del Modo Perreo en la web: tipos, consultas y formato de cifras y fechas (sin DOM).
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { PerreoArtist } from './perreo-types'

export type PulsePeriod = 'week' | 'month' | 'year'
export type ReleasePeriod = PulsePeriod | 'upcoming'
export type ReleaseKind = 'album' | 'song'

/** Lo justo de un artista para pintar su foto, nombre y color. */
export interface PulseArtist {
  slug: string
  name: string
  nickname: string | null
  photoV: string | null
  color: string | null
  countries: string[]
  fame: number
}

export interface PerreoRelease {
  id: string
  artistSlug: string
  kind: ReleaseKind
  recordType: string | null
  title: string
  releaseDate: string
  coverUrl: string | null
  link: string | null
  source: 'deezer' | 'musicbrainz' | string
  fans: number | null
  artist: PulseArtist
}

export interface PerreoReleases {
  period: ReleasePeriod
  kind: ReleaseKind | null
  /** Día del último `pnpm perreo:pulse` (null si no se ha lanzado). */
  updated: string | null
  counts: Record<ReleasePeriod, Record<ReleaseKind, number>>
  releases: PerreoRelease[]
}

export interface HotEntry {
  slug: string
  score: number
  reasons: string[]
  growth: number | null
  releases: number
  geoRank: number | null
  artist: PulseArtist
}

export interface PerreoHot {
  period: PulsePeriod
  country: string | null
  updated: string | null
  countries: { value: string; count: number }[]
  entries: HotEntry[]
}

export type CompareMetricId =
  | 'youtubeViews'
  | 'youtubeSubs'
  | 'lastfmListeners'
  | 'lastfmPlays'
  | 'deezerFans'
  | 'fame'
  | 'topCountries'
  | 'streetLevel'
  | 'yearsActive'
  | 'deezerAlbums'
  | 'albumsPerYear'
  | 'catalogSongs'
  | 'collabs'
  | 'releasesYear'
export type CompareGroup = 'audience' | 'street' | 'career'
export type HistoryMetric = 'lastfmListeners' | 'deezerFans' | 'youtubeViews' | 'fame'
export type HistoryPoint = { day: string } & Partial<Record<HistoryMetric, number | null>>

/** Lo que se sabe de cada uno, sin número que comparar (la «ficha» del 1 vs 1). */
export interface VersusProfile {
  debutYear: number | null
  activeUntil: number | null
  status: string | null
  country: string | null
  city: string | null
  labels: string[]
  styles: string[]
  topIn: { country: string; rank: number }[]
}

export interface CompareMetricResult {
  id: CompareMetricId
  label: string
  source: string
  group?: CompareGroup
  scale?: 'log' | 'linear'
  max: number
  winners: string[]
  shares: Record<string, number | null>
  /** Largo de la barra (escala logarítmica en audiencia); si falta, `shares`. */
  bars?: Record<string, number | null>
}

export interface PerreoCompare {
  updated: string | null
  artists: PulseArtist[]
  values: Record<string, Partial<Record<CompareMetricId, number | null>>>
  profiles?: Record<string, VersusProfile>
  /** Fotos diarias de `perreo:pulse` por artista, de la más antigua a la más reciente. */
  history?: Record<string, HistoryPoint[]>
  /** Días distintos con foto: con menos de 2 no hay evolución. */
  historyDays?: number
  result: {
    metrics: CompareMetricResult[]
    wins: Record<string, number>
    champion: string | null
  }
}

export const COMPARE_GROUPS: { id: CompareGroup; label: string }[] = [
  { id: 'audience', label: 'La audiencia' },
  { id: 'street', label: 'La calle' },
  { id: 'career', label: 'La carrera' },
]

export const HISTORY_LABELS: Record<HistoryMetric, string> = {
  lastfmListeners: 'Oyentes en Last.fm',
  deezerFans: 'Fans en Deezer',
  youtubeViews: 'Visitas en YouTube',
  fame: 'Popularidad',
}

/** Cifra de una métrica: las de ritmo con un decimal («1,5»), el resto compactas. */
export const metricNumber = (n: number | null | undefined) => (n != null && !Number.isInteger(n) ? n.toFixed(1).replace('.', ',') : compactNumber(n))

/** Métricas del historial con al menos 2 días de datos de alguien. */
export function historyMetrics(history: Record<string, HistoryPoint[]> | undefined): HistoryMetric[] {
  if (!history) return []
  return (Object.keys(HISTORY_LABELS) as HistoryMetric[]).filter((m) => Object.values(history).some((pts) => pts.filter((p) => p[m] != null).length >= 2))
}

/**
 * Líneas de la evolución: eje X por día (común a todos) y eje Y de 0 a 1 entre el mínimo y el
 * máximo de todos, para que se vea quién sube más. Cada artista lleva su crecimiento del primer al último día.
 */
export function historyLines(history: Record<string, HistoryPoint[]>, metric: HistoryMetric) {
  const days = [...new Set(Object.values(history).flatMap((pts) => pts.filter((p) => p[metric] != null).map((p) => p.day)))].sort()
  const values = Object.values(history).flatMap((pts) => pts.map((p) => p[metric]).filter((v): v is number => v != null))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = (day: string) => (days.length > 1 ? days.indexOf(day) / (days.length - 1) : 0.5)
  const y = (v: number) => (max > min ? (v - min) / (max - min) : 0.5)
  const lines = Object.fromEntries(
    Object.entries(history).map(([slug, pts]) => {
      const known = pts.filter((p): p is HistoryPoint & Record<HistoryMetric, number> => p[metric] != null)
      const first = known[0]?.[metric]
      const last = known.at(-1)?.[metric]
      return [slug, { points: known.map((p) => ({ x: x(p.day), y: y(p[metric]) })), growth: known.length >= 2 && first ? (last! - first) / first : null }]
    }),
  )
  return { days, lines }
}

/** +3,2 % / −0,4 % / = */
export const growthLabel = (g: number | null) => (g == null ? '' : Math.abs(g) < 0.0005 ? '=' : `${g > 0 ? '+' : '−'}${(Math.abs(g) * 100).toFixed(1).replace('.', ',')} %`)

export const PERIOD_LABELS: Record<ReleasePeriod, string> = { week: 'Esta semana', month: 'Este mes', year: 'Este año', upcoming: 'Lo que viene' }
export const PERIOD_HINTS: Record<ReleasePeriod, string> = { week: 'últimos 7 días', month: 'últimos 30 días', year: 'desde el 1 de enero', upcoming: 'fechas anunciadas' }

export function useReleases(period: ReleasePeriod, kind: ReleaseKind | '', country = '') {
  const q = new URLSearchParams({ period, ...(kind ? { kind } : {}), ...(country ? { country } : {}) }).toString()
  return useQuery({ queryKey: ['perreo', 'releases', q], queryFn: () => api.perreoReleases(q), staleTime: 10 * 60_000, placeholderData: (prev) => prev })
}

export function useHot(period: PulsePeriod, country = '') {
  const q = new URLSearchParams({ period, ...(country ? { country } : {}) }).toString()
  return useQuery({ queryKey: ['perreo', 'hot', q], queryFn: () => api.perreoHot(q), staleTime: 10 * 60_000, placeholderData: (prev) => prev })
}

export function useCompare(slugs: string[]) {
  const key = slugs.join(',')
  return useQuery({ queryKey: ['perreo', 'compare', key], queryFn: () => api.perreoCompare(key), enabled: slugs.length >= 2, staleTime: 10 * 60_000 })
}

/** 1 234 → «1,2 mil»; 3 400 000 → «3,4 M»; 2 100 000 000 → «2,1 mil M». */
export function compactNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const fmt = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, '').replace('.', ','))
  if (abs >= 1e9) return `${fmt(n / 1e9)} mil M`
  if (abs >= 1e6) return `${fmt(n / 1e6)} M`
  if (abs >= 1e4) return `${fmt(n / 1e3)} mil`
  return n.toLocaleString('es-ES')
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

/** «Hoy», «Ayer», «Hace 3 días», «Mañana», «En 12 días», «5 dic 2026», «2027» (si solo se sabe el año). */
export function releaseWhen(date: string, now = new Date()): string {
  if (/^\d{4}$/.test(date)) return date
  if (/^\d{4}-\d{2}$/.test(date)) return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const d = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))
  const days = Math.round((d - today) / 86_400_000)
  if (days === 0) return 'Hoy'
  if (days === -1) return 'Ayer'
  if (days === 1) return 'Mañana'
  if (days < 0 && days > -7) return `Hace ${-days} días`
  if (days > 0 && days <= 30) return `En ${days} días`
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
}

/** Fracción 0–1 animable: nunca invisible si tiene dato (un 2 % se ve), 0 si no hay dato. */
export const barWidth = (share: number | null | undefined) => (share == null ? 0 : Math.max(0.04, Math.min(1, share)))

/** Cuenta atrás de un número que sube (marcador): valor en el instante `t` (0–1) con frenada final. */
export const countUp = (target: number, t: number) => Math.round(target * (1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3)))

/** Nota honesta sobre las cifras (sale en Novedades, Lo más caliente y Cara a cara). */
export const DATA_NOTE =
  'Spotify no tiene una API pública de oyentes mensuales, así que aquí no salen. Usamos lo que sí es oficial y gratuito: oyentes y reproducciones de Last.fm, fans de Deezer y visitas del canal de YouTube. Fechas de lanzamiento de Deezer y MusicBrainz.'

/** Artista del día: el mismo para todos durante el día (con foto, artista o grupo) y cambia a medianoche. */
export function artistOfTheDay(list: PerreoArtist[], date = new Date()): PerreoArtist | null {
  const pool = list.filter((a) => (a.kind === 'artist' || a.kind === 'group') && a.photoV).sort((a, b) => a.slug.localeCompare(b.slug))
  if (!pool.length) return null
  const seed = Number(date.toISOString().slice(0, 10).replace(/-/g, ''))
  return pool[(Math.imul(seed, 2654435761) >>> 0) % pool.length]
}
