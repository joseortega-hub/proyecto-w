// Preferencias previas por dominio (p. ej. el idioma de la letra): filtros duros que se
// eligen antes de la entrevista. Se recuerdan en este dispositivo y se aplican a la sesión
// justo antes de Afinando, que es donde se busca.
import { useCallback, useState } from 'react'

export interface PreferenceOption {
  value: string
  label: string
}

export interface Preference {
  key: string
  label: string
  options: PreferenceOption[]
  /** Opción que no filtra ("Me da igual"). */
  anyValue: string
}

export type SessionPreferences = Record<string, { value: string; source: 'user' | 'guess'; confidence: number | null }>

const storageKey = (domainId: string) => `sintonia:preferencias:${domainId}`

function read(domainId: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(domainId)) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

/** Preferencias elegidas en este dispositivo para un dominio. */
export function usePreferences(domainId: string) {
  const [chosen, setChosen] = useState(() => read(domainId))
  const choose = useCallback(
    (key: string, value: string) => {
      setChosen((prev) => {
        const next = { ...prev, [key]: value }
        try {
          localStorage.setItem(storageKey(domainId), JSON.stringify(next))
        } catch {
          // Sin almacenamiento (modo privado): la elección vale solo para esta visita.
        }
        return next
      })
    },
    [domainId],
  )
  return { chosen, choose }
}

/** Preferencias guardadas en el dispositivo, para aplicarlas fuera de un componente. */
export const storedPreferences = read

async function send<T>(path: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Error ${res.status}`)
  return res.json() as Promise<T>
}

/** Aplica las preferencias a la sesión. Las que falten, el servidor las deduce del texto inicial. */
export const applyPreferences = (sessionId: string, preferences: Record<string, string>) =>
  send<SessionPreferences>(`/sessions/${sessionId}/preferences`, 'PUT', { preferences })

/** Preselección a partir del texto inicial (con su confianza). No guarda el texto. */
export const guessPreferences = (domainId: string, text: string) =>
  send<SessionPreferences>(`/domains/${domainId}/preferences/guess`, 'POST', { text })
