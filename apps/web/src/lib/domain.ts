import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useParams } from 'react-router'
import { api } from './api'

/** Mientras solo haya un dominio, "/" lleva a él. Con varios, "/" será el selector de dominio. */
export const DEFAULT_DOMAIN = 'music'

export function useDomains() {
  return useQuery({ queryKey: ['domains'], queryFn: api.getDomains, staleTime: Infinity })
}

/**
 * Dominio de la ruta actual (/:domain/…). Cada temática tiene su propia biblioteca,
 * sus listas y sus entrevistas; `path` construye enlaces dentro del mismo dominio.
 */
export function useDomain() {
  const { domain = DEFAULT_DOMAIN } = useParams()
  const domains = useDomains()
  const info = domains.data?.find((d) => d.id === domain)
  const path = useCallback((sub = '') => `/${domain}${sub ? `/${sub}` : ''}`, [domain])
  return {
    id: domain,
    info,
    loading: domains.isPending,
    exists: domains.isPending || !!info,
    /** Sustantivo plural del dominio ("canciones", "películas"…). */
    nounPlural: info?.itemNounPlural ?? 'elementos',
    path,
  }
}
