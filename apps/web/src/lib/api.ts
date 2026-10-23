// Cliente REST de la API de Sintonía. Vite redirige /api a la API en local.
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
  question: { text: string; reason: string; guess: string } | null
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
  entries: ResultEntry[]
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
  /** `initialText` es el punto de partida opcional (texto o voz) antes de las preguntas. */
  startSession: (domainId = 'music', initialText?: string) =>
    request<SessionView>('/sessions', { method: 'POST', body: JSON.stringify({ domainId, initialText }) }),
  getSession: (id: string) => request<SessionView>(`/sessions/${id}`),
  answer: (id: string, answer: Answer) =>
    request<SessionView>(`/sessions/${id}/answers`, { method: 'POST', body: JSON.stringify({ answer }) }),
  undo: (id: string) => request<SessionView>(`/sessions/${id}/undo`, { method: 'POST' }),
  getResult: (id: string) => request<SessionResult>(`/sessions/${id}/result`),

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
