// Conectar YouTube: estado de la cuenta, importación de la música y listas en la cuenta.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type SessionResult } from './api'

const key = ['youtube', 'status']

/** Estado de la conexión. Mientras importa, se refresca cada 2 s para la barra de progreso. */
export function useYouTubeStatus(enabled = true) {
  return useQuery({
    queryKey: key,
    queryFn: api.youtubeStatus,
    enabled,
    staleTime: 10_000,
    refetchInterval: (query) => (query.state.data?.import?.status === 'running' ? 2000 : false),
  })
}

/** Lleva a la pantalla de consentimiento de Google. Al volver, la API redirige a /youtube. */
export function useConnectYouTube() {
  return useMutation({
    mutationFn: api.youtubeAuth,
    onSuccess: ({ url }) => window.location.assign(url),
  })
}

/** Importa (o reimporta): todo, o solo las listas elegidas. */
export function useImportYouTube() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (playlistIds?: string[]) => api.youtubeImport(playlistIds),
    onSuccess: (status) => {
      queryClient.setQueryData(key, status)
      void queryClient.invalidateQueries({ queryKey: ['youtube', 'playlists'] })
    },
  })
}

/** Listas propias de YouTube (1-2 unidades de cuota): solo se piden al abrir el selector. */
export function useYouTubePlaylists(enabled: boolean) {
  return useQuery({ queryKey: ['youtube', 'playlists'], queryFn: api.youtubePlaylists, enabled, staleTime: 5 * 60_000 })
}

export function useDisconnectYouTube() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.youtubeDisconnect,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ['domains'] })
      void queryClient.invalidateQueries({ queryKey: ['taste', 'youtube'] })
    },
  })
}

/** "Guardar en mi YouTube": crea la lista y la apunta en el resultado en caché. */
export function useSaveToYouTube(sessionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.saveToYouTube(sessionId),
    onSuccess: ({ playlistId, url }) =>
      queryClient.setQueryData<SessionResult>(['result', sessionId], (r) => (r ? { ...r, youtube: { playlistId, url } } : r)),
  })
}
