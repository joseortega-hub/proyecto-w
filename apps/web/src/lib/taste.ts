// Perfil de gustos de la temática actual (largo plazo), separado del ánimo de cada entrevista.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Feedback, type Taste } from './api'

const key = (domainId: string) => ['taste', domainId]

export function useTaste(domainId: string) {
  return useQuery({ queryKey: key(domainId), queryFn: () => api.getTaste(domainId), enabled: !!domainId, staleTime: 60_000 })
}

export function useSaveTaste(domainId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { likes: string[]; dislikes: string[]; preferences?: Record<string, string> }) => api.saveTaste(domainId, body),
    onSuccess: (taste) => queryClient.setQueryData(key(domainId), taste),
  })
}

export function useDeleteTaste(domainId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.deleteTaste(domainId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(domainId) }),
  })
}

/** 👍/👎 con respuesta optimista: el botón cambia al instante. */
export function useFeedback(domainId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, value }: { itemId: string; value: Feedback | null }) => api.feedback(domainId, itemId, value),
    onMutate: ({ itemId, value }) => {
      const previous = queryClient.getQueryData<Taste>(key(domainId))
      if (previous) {
        const feedback = { ...previous.feedback }
        if (value) feedback[itemId] = value
        else delete feedback[itemId]
        queryClient.setQueryData(key(domainId), { ...previous, feedback })
      }
      return { previous }
    },
    onError: (_e, _v, context) => context?.previous && queryClient.setQueryData(key(domainId), context.previous),
    onSuccess: (taste) => queryClient.setQueryData(key(domainId), taste),
  })
}
