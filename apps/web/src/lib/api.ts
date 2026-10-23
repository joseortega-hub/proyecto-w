// Cliente REST de la API de Sintonía. Vite redirige /api a la API en local.
import type { Preference, SessionPreferences } from './preferences'

export type Answer = 'yes' | 'no' | 'unknown'

export interface SessionView {
  id: string
  domainId: string
  status: 'asking' | 'ready' | 'done'
  step: number
  minQuestions: number
  maxQuestions: number
  confidence: number
  chips: string[]
  question: { text: string; reason: string; guess: string; chips: { yes: string; no: string } } | null
  canUndo: boolean
  decisionProvider: string
}

export interface Item {
  id: string
  domainId: string
  source: string
  externalId: string
  title: string
  subtitle: string | null
  description: string | null
  imageUrl: string | null
  mediaUrl: string | null
  externalUrl: string | null
  durationSec: number | null
  attributes: Record<string, number>
  tags: string[]
  popularity: number
  /** Valores categóricos para las preferencias previas (p. ej. `language: es`). */
  facets?: Record<string, string>
}

export interface Attribute {
  key: string
  label: string
  kind: 'scale' | 'tags'
  description: string
  lowLabel?: string
  highLabel?: string
}

export interface MoodProfile {
  scales: Record<string, number>
  tagGroups: Record<string, number>
  informed: string[]
  /** Confianza 0–1 por dimensión. */
  confidence?: Record<string, number>
  summary: string[]
}

export interface DomainInfo {
  id: string
  name: string
  itemNoun: string
  itemNounPlural: string
  itemCount: number
  attributes: Attribute[]
  refinements: { key: string; label: string }[]
  interview: { minQuestions: number; maxQuestions: number; confidenceToFinish: number }
  /** Preferencias previas (filtros duros) que se eligen antes de la entrevista. */
  preferences: Preference[]
}

export interface ResultEntry {
  match: number
  /** Probabilidad de encaje (0–1) que dio el DecisionProvider. */
  fit: number | null
  reason: string
  item: Item
}

export interface SessionResult {
  id: string
  domainId: string
  title: string
  answeredCount: number
  chips: string[]
  profile: MoodProfile
  attributes: Attribute[]
  refinements: { key: string; label: string }[]
  appliedRefinements: string[]
  candidates: number
  catalogSize: number
  preferences: SessionPreferences
  /** Aviso cuando un filtro deja pocos elementos (p. ej. pocas en español). */
  notice: string | null
  entries: ResultEntry[]
}

export interface SimilarItems {
  itemId: string
  /** Vecinos por embedding del mismo dominio, con su similitud coseno (0–1). */
  items: { similarity: number; item: Item }[]
}

export type TuningEvent =
  | { step: 'profile'; profile: MoodProfile }
  | { step: 'candidates'; count: number; total: number }
  | { step: 'fit'; checked: number; total: number }
  | { step: 'explain' }
  | { step: 'done'; sessionId: string }
  | { step: 'error'; message: string }

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.message ?? `Error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getDomains: () => request<DomainInfo[]>('/domains'),
  /** `initialText` es el punto de partida opcional (texto o voz) antes de las preguntas. */
  startSession: (domainId: string, initialText?: string) =>
    request<SessionView>('/sessions', { method: 'POST', body: JSON.stringify({ domainId, initialText }) }),
  getSession: (id: string) => request<SessionView>(`/sessions/${id}`),
  /** `step` es el número de la pregunta que se responde: el servidor rechaza (409) los dobles envíos. */
  answer: (id: string, answer: Answer, step?: number) =>
    request<SessionView>(`/sessions/${id}/answers`, { method: 'POST', body: JSON.stringify({ answer, step }) }),
  undo: (id: string) => request<SessionView>(`/sessions/${id}/undo`, { method: 'POST' }),
  getResult: (id: string) => request<SessionResult>(`/sessions/${id}/result`),
  getSimilar: (itemId: string, limit = 10) => request<SimilarItems>(`/items/${itemId}/similar?limit=${limit}`),

  /** Sigue el progreso de Afinando por Server-Sent Events. Devuelve la función para cancelar. */
  tune(id: string, refine: string[], onEvent: (e: TuningEvent) => void): () => void {
    const qs = refine.length ? `?refine=${encodeURIComponent(refine.join(','))}` : ''
    const source = new EventSource(`/api/sessions/${id}/tune${qs}`)
    source.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as TuningEvent
      onEvent(event)
      if (event.step === 'done' || event.step === 'error') source.close()
    }
    source.onerror = () => {
      source.close()
      onEvent({ step: 'error', message: 'Se ha cortado la conexión con el servidor' })
    }
    return () => source.close()
  },
}
