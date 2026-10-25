// "Para saber más": enlaces reales y verificados sobre una franquicia, saga, autor, estudio o artista.
import { useQuery } from '@tanstack/react-query'
import { api, type EntityLinks, type Item, type ItemDetails, type LinkSite } from './api'

/** Nombre y forma de presentar cada sitio. */
export const SITE_LABELS: Record<LinkSite, string> = {
  official: 'Web oficial',
  wikipedia: 'Wikipedia',
  fandom: 'Wiki de fans',
  tmdb: 'TMDB',
  rawg: 'RAWG',
  openlibrary: 'Open Library',
  musicbrainz: 'MusicBrainz',
  reddit: 'Comunidad en Reddit',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
}

/** Dominio legible de una URL ("marvel.com"). */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null

/**
 * De qué va la ficha de un elemento, para buscar sus enlaces: la saga en películas (si no, quien
 * la dirige), el estudio en videojuegos, la autoría en libros y el artista en música.
 */
export function itemEntity(item: Item, details?: ItemDetails): string | null {
  const d = details ?? item.details ?? {}
  switch (item.domainId) {
    case 'movies': {
      const saga = first(item.facets?.collection)?.replace(/\s*[-–:]?\s*\b(colecci[oó]n|collection|saga)\b\s*[-–:]?\s*/gi, ' ').trim()
      return saga || d.director || null
    }
    case 'games':
      return d.developers?.[0] ?? first(item.facets?.companies)
    case 'books':
      return d.authors?.[0] ?? item.subtitle
    default:
      // Música: el artista principal, sin los invitados ("Bad Bunny feat. X" → "Bad Bunny").
      return item.subtitle?.split(/\s*,\s*|\s+&\s+|\s+x\s+|\s+(?:feat|ft)\.?\s+/i)[0]?.trim() || null
  }
}

/** Enlaces de una entidad; sin entidad no pide nada. Cambian poco: se guardan toda la sesión. */
export function useEntityLinks(domainId: string, entity: string | null | undefined) {
  const name = entity?.trim() ?? ''
  return useQuery<EntityLinks>({
    queryKey: ['links', domainId, name.toLowerCase()],
    queryFn: () => api.getLinks(domainId, name),
    enabled: name.length >= 2,
    staleTime: Infinity,
    retry: false,
  })
}

/** Enlaces de una lista: la API elige lo concreto que se pidió (no los estilos). Solo si hubo ancla. */
export function useSessionLinks(sessionId: string, anchors: string[] | undefined) {
  return useQuery<EntityLinks>({
    queryKey: ['links', 'session', sessionId],
    queryFn: () => api.getSessionLinks(sessionId),
    enabled: !!sessionId && (anchors?.length ?? 0) > 0,
    staleTime: Infinity,
    retry: false,
  })
}
