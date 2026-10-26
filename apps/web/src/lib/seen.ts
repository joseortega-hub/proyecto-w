// «Ya lo vi / leí / jugué / escuché»: lo ya consumido no vuelve a recomendarse.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Item, type SeenList, type SeenRating } from './api'

/** Temáticas públicas con «ya visto» (los catálogos personales ya son de la persona). */
export const SEEN_DOMAINS = ['movies', 'books', 'games', 'music']
export const hasSeen = (domainId: string) => SEEN_DOMAINS.includes(domainId)

export interface SeenWords {
  /** El botón: «Ya la vi». */
  mark: string
  /** Marcado: «Vista». */
  done: string
  /** La sección: «Ya vistas». */
  section: string
  /** Para los avisos: «vista», «leído». */
  participle: string
}

const WORDS: Record<string, SeenWords> = {
  movies: { mark: 'Ya la vi', done: 'Vista', section: 'Ya vistas', participle: 'vista' },
  books: { mark: 'Ya lo leí', done: 'Leído', section: 'Ya leídos', participle: 'leído' },
  games: { mark: 'Ya lo jugué', done: 'Jugado', section: 'Ya jugados', participle: 'jugado' },
  music: { mark: 'Ya la escuché', done: 'Escuchada', section: 'Ya escuchadas', participle: 'escuchada' },
}

/** El verbo cambia según la temática. */
export const seenWords = (domainId: string): SeenWords => WORDS[domainId] ?? WORDS.movies

export const RATINGS: { value: SeenRating; label: string; emoji: string }[] = [
  { value: 'loved', label: 'Me encantó', emoji: '😍' },
  { value: 'liked', label: 'Bien', emoji: '🙂' },
  { value: 'meh', label: 'Meh', emoji: '😐' },
]

const key = (domainId: string) => ['seen', domainId]

export function useSeen(domainId: string) {
  return useQuery({ queryKey: key(domainId), queryFn: () => api.getSeen(domainId), enabled: hasSeen(domainId), staleTime: 60_000 })
}

/** Valoración de cada elemento ya visto (`undefined` si no lo está). */
export function seenMap(list?: SeenList): Map<string, SeenRating | null> {
  return new Map((list?.entries ?? []).map((e) => [e.item.id, e.rating]))
}

/** Marcar, cambiar la valoración o desmarcar, con respuesta optimista. */
export function useSeenMutation(domainId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ item, rating, seen }: { item: Item; rating: SeenRating | null; seen: boolean }) =>
      seen ? api.markSeen(domainId, item.id, rating) : api.unmarkSeen(domainId, item.id),
    onMutate: ({ item, rating, seen }) => {
      const previous = queryClient.getQueryData<SeenList>(key(domainId))
      if (previous) {
        const rest = previous.entries.filter((e) => e.item.id !== item.id)
        const before = previous.entries.find((e) => e.item.id === item.id)
        const entries = seen ? [{ item, rating, source: before?.source ?? 'app', seenAt: new Date().toISOString() }, ...rest] : rest
        queryClient.setQueryData<SeenList>(key(domainId), { ...previous, entries, total: entries.length })
      }
      return { previous }
    },
    onError: (_e, _v, context) => context?.previous && queryClient.setQueryData(key(domainId), context.previous),
    // La valoración cambia lo aprendido del perfil de gustos.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['taste', domainId] }),
  })
}
