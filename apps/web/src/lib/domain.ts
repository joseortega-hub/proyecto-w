import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useParams } from 'react-router'
import type { IconName } from '@/components/atoms/Icon'
import { api, type DomainInfo } from './api'
import { usePerreoUnlock } from './perreo'

/** Todas las temáticas, también las secretas (para resolver la ruta actual). */
function useAllDomains() {
  return useQuery({ queryKey: ['domains'], queryFn: api.getDomains, staleTime: 60_000 })
}

/** Las temáticas que se enseñan: las secretas solo a quien las ha desbloqueado. */
export function useDomains() {
  const query = useAllDomains()
  const unlocked = usePerreoUnlock() !== null
  const data = query.data?.filter((d) => !d.hidden || unlocked)
  return { ...query, data } as typeof query
}

/**
 * Icono de cada temática. El color va en CSS (`[data-domain]` en index.css), así que
 * cualquier pieza dentro de un dominio puede usar `bg-domain`, `text-domain`…
 */
const ICONS: Record<string, IconName> = { music: 'music', youtube: 'youtube', folder: 'folder', games: 'games', movies: 'movies', books: 'books', perreo: 'flame' }
export const domainIcon = (id: string): IconName => ICONS[id] ?? 'sparkles'

/** "esta canción", "este videojuego". */
export const demonstrative = (info?: Pick<DomainInfo, 'gender'>) => (info?.gender === 'm' ? 'este' : 'esta')
/** "candidatas" o "candidatos" según el sustantivo del dominio. */
export const agree = (info: Pick<DomainInfo, 'gender'> | undefined, feminine: string, masculine: string) =>
  info?.gender === 'm' ? masculine : feminine

/**
 * Dominio de la ruta actual (/:domain/…). Cada temática tiene su propia biblioteca,
 * sus listas y sus entrevistas; `path` construye enlaces dentro del mismo dominio.
 */
export function useDomain() {
  const { domain = '' } = useParams()
  const domains = useAllDomains()
  const info = domains.data?.find((d) => d.id === domain)
  const path = useCallback((sub = '') => `/${domain}${sub ? `/${sub}` : ''}`, [domain])
  return {
    id: domain,
    info,
    loading: domains.isPending,
    exists: domains.isPending || domains.isError || !!info,
    /** Sustantivo plural del dominio ("canciones", "películas"…). */
    nounPlural: info?.itemNounPlural ?? 'elementos',
    icon: domainIcon(domain),
    playable: info?.playable ?? domain === 'music',
    /** Catálogo personal (la música de YouTube o de la carpeta de la persona). */
    personal: info?.personal ?? false,
    path,
  }
}
