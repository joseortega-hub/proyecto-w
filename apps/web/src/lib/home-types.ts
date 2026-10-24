// Tipos de «Hoy para ti» y «Tu historia» (las respuestas de /home, /route-intent y /story).
import type { InterviewContext } from './context'
import type { Item } from './api'

export interface IntentOption {
  domainId: string
  confidence: number
}

export interface AvailableDomain {
  id: string
  name: string
  noun: string
  personal: boolean
}

export interface RouteIntentResult {
  /** Temática a la que ir directamente; null si hay que elegir entre `options`. */
  domainId: string | null
  options: IntentOption[]
  via: 'ai' | 'rules'
  available: AvailableDomain[]
}

export interface ComboSlot {
  domainId: string
  /** "para ahora", "para después", "para mañana". */
  role: string
  /** "Noche de sábado con lluvia: algo pausado". */
  why: string
  entries: { reason: string; item: Item }[]
}

export interface ComboView {
  title: string
  slots: ComboSlot[]
}

export interface DomainActivity {
  domainId: string
  lastList: { sessionId: string; title: string; at: string; count: number } | null
  resumeSessionId: string | null
  lists: number
}

export interface HomeSummary {
  context: InterviewContext
  combo: ComboView | null
  activity: DomainActivity[]
}

export interface Counted {
  label: string
  count: number
}

export interface StoryDay {
  id: string
  domainId: string
  at: string
  title: string
  scales: Record<string, number>
  context: { franja: string | null; diaSemana: string | null; finDeSemana: boolean; tiempo: string | null }
}

export interface StoryTopDomain {
  domainId: string
  name: string
  creators: Counted[]
  genres: Counted[]
  total: number
  liked: number
}

export interface StoryLearned {
  domainId: string
  name: string
  likes: string[]
  dislikes: string[]
  up: { label: string; weight: number }[]
  down: { label: string; weight: number }[]
  thumbsUp: number
  thumbsDown: number
}

export interface StoryAi {
  calls: number
  providers: Counted[]
  listCostEur: number
  paidEur: number
  lists: number
  /** Dimensiones que el texto inicial dejó claras y que, por tanto, no hubo que preguntar. */
  questionsSaved: number
  tracesWindowHours: number
}

export interface StoryView {
  lists: number
  days: StoryDay[]
  top: StoryTopDomain[]
  /** % de lo recomendado que va con los gustos; null si no hay listas. */
  tasteFit: number | null
  learned: StoryLearned[]
  ai: StoryAi
}
