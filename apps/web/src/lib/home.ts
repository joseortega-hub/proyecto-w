// «Hoy para ti»: datos de la main y envío de la barra universal.
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { useState } from 'react'
import { api } from './api'
import { clientContext } from './context'
import type { RouteIntentResult } from './home-types'
import { matchSecretPhrase } from './secret-phrases'

/** Contexto, combo y actividad. El combo cambia despacio (franja, día, tiempo): 10 min de caché. */
export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: async () => api.getHome(await clientContext()),
    staleTime: 10 * 60_000,
  })
}

/**
 * Lógica de la barra universal: primero el gancho de frases secretas (sin red) y, si no es
 * ninguna, detecta la temática. Con confianza alta navega a su entrevista con el texto como
 * punto de partida (viaja en el estado de la navegación, nunca en la URL ni en el dispositivo);
 * con poca, deja las opciones en `choices` para elegir con un toque.
 */
export function useUniversalBar() {
  const navigate = useNavigate()
  const [choices, setChoices] = useState<RouteIntentResult | null>(null)
  const [text, setText] = useState('')

  const go = (domainId: string, initialText: string) =>
    navigate(`/${domainId}/entrevista`, { state: { initialText, preferences: {} } })

  const route = useMutation({
    mutationFn: async (value: string) => {
      const secret = await matchSecretPhrase(value)
      if (secret) {
        secret.activate({ navigate })
        return null
      }
      return api.routeIntent(value)
    },
    onSuccess: (result, value) => {
      if (!result) return
      if (result.domainId) go(result.domainId, value)
      else setChoices(result)
    },
  })

  return {
    text,
    setText: (value: string) => {
      setText(value)
      if (choices) setChoices(null)
    },
    submit: () => {
      const value = text.trim()
      if (value && !route.isPending) route.mutate(value)
    },
    pick: (domainId: string) => go(domainId, text.trim()),
    choices,
    busy: route.isPending,
    error: route.isError ? 'No he podido entenderte ahora mismo. Elige una temática abajo.' : null,
  }
}
