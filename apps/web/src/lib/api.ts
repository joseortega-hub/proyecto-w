// Cliente REST de la API de Sintonía. Vite redirige /api a la API en local.
import type { ClientContext, InterviewContext } from './context'
import type { FeedbackImage, FeedbackKind } from './feedback'
import type { Preference, SessionPreferences } from './preferences'
import type { CompareResult, Judgement, OpsPanel, TraceRow } from './ops-types'
import type { ResolvedTheme } from '@sintonia/tokens/engine'
import type { HomeSummary, RouteIntentResult, StoryView } from './home-types'
import type { PerreoArtistDetail, PerreoArtistList, PerreoArtistPatch, PerreoReview, PerreoYouTube } from './perreo-types'
import type { PerreoCompare, PerreoHot, PerreoReleases } from './perreo-pulse'
import { userHeaders } from './user'

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
  question: { text: string; lead: string; reason: string; guess: string; chips: { yes: string; no: string } } | null
  canUndo: boolean
  decisionProvider: string
  /** Hora, día y tiempo con los que se adapta la entrevista. */
  context: InterviewContext
  /** Lo que ya dejó claro el punto de partida ("tranquilo"): no se pregunta. */
  fromText: string[]
  /** Gustos guardados que se tienen en cuenta. */
  taste: string[]
  /** Lo concreto que pidió en el punto de partida ("Marvel"): la entrevista y la lista se centran en ello. */
  anchors: string[]
  /** Filtros previos activos ("Nintendo") y lo que no quiere ("terror"). */
  filters: string[]
  excluded: string[]
  /** Candidatas que quedan (masa efectiva de la bolsa); null si la entrevista no lleva bolsa. */
  candidates: { left: number; total: number } | null
}

export interface Anchor {
  label: string
  kind: 'franchise' | 'creator' | 'studio' | 'title' | 'tag'
  terms: string[]
  required: boolean
  /** Nombre propio pedido por palabras (filtro duro) y, si lo corregimos, cómo lo escribió. */
  named?: boolean
  said?: string
}

/** Lo que la IA entiende del texto inicial ("Esto es lo que he entendido"). */
export interface Understanding {
  moods: { key: string; level: 'low' | 'high'; confidence: number }[]
  anchors: Anchor[]
  preferences: Record<string, { value: string; confidence: number }>
  exclusions: string[]
  /** Lo pedido que no está (o no entero) en el catálogo y se está buscando en directo en la fuente. */
  searching?: string[]
}

/** Lo entendido ya corregido por la persona, que viaja con la creación de la sesión. */
export interface EditedUnderstanding {
  moods: { key: string; level: 'low' | 'high' }[]
  anchors: Anchor[]
  preferences: Record<string, string>
  exclusions: string[]
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
  /** Valores categóricos (`language: 'es'`, `platforms: ['pc', 'switch']`, `year: '2015'`). */
  facets?: Record<string, string | string[]>
  /** Datos "para frikis" de las APIs (créditos, ficha técnica). Puede venir vacío. */
  details?: ItemDetails
}

/** Créditos y ficha técnica que traen las APIs; nunca los genera la IA. */
export interface ItemDetails {
  director?: string
  cast?: string[]
  year?: number
  runtimeMin?: number
  rating?: number
  developers?: string[]
  publishers?: string[]
  released?: string
  metacritic?: number
  platforms?: string[]
  authors?: string[]
  pages?: number
  subjects?: string[]
  album?: string
  producers?: string[]
  composers?: string[]
  lyricists?: string[]
  featured?: string[]
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
  /** Género gramatical del sustantivo: "esta canción" (f), "este videojuego" (m). */
  gender: 'f' | 'm'
  /** Verbo de consumo: "escuchar", "ver", "leer", "jugar". */
  verb: string
  /** Quién firma cada elemento ("artista", "dirección", "autoría", "estudio"). */
  creatorLabel: string
  /** Solo los dominios reproducibles (música) usan el reproductor; el resto enlaza a la fuente. */
  playable: boolean
  /** Catálogo personal: cada persona importa el suyo (la música de su YouTube) y solo ve lo suyo. */
  personal: boolean
  /** Temática secreta: solo se enseña a quien la ha desbloqueado. */
  hidden: boolean
  /** Fuente de los datos con su atribución obligatoria. */
  source: { name: string; url: string; attribution: string }
  tagGroups: { key: string; label: string; tags: string[] }[]
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
  /** Gustos de la persona con los que encaja ("rol y aventura"). */
  likes?: string[]
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
  /** Cuántos de la lista van con los gustos guardados. */
  likedCount?: number
  preferences: SessionPreferences
  /** Aviso cuando un filtro deja pocos elementos (p. ej. pocas en español o pocas de Marvel). */
  notice: string | null
  /** Lo concreto que pidió en el punto de partida ("Marvel"). */
  anchors: string[]
  /** Lista ya creada en la cuenta de YouTube (solo en "Mi YouTube"). */
  youtube: { playlistId: string; url: string } | null
  /** "Tu vibra": origen de cada dimensión, contexto y barras que la persona ha movido. */
  vibe: {
    sources: Record<string, string>
    context: { franja: string | null; diaSemana: string | null; finDeSemana: boolean; tiempo: string | null }
    adjusted: string[]
  }
  entries: ResultEntry[]
}

/** Sitio de un enlace de "Para saber más". */
export type LinkSite = 'official' | 'wikipedia' | 'fandom' | 'tmdb' | 'rawg' | 'openlibrary' | 'musicbrainz' | 'reddit' | 'instagram' | 'youtube' | 'x'

/** "Para saber más": la entidad de Wikidata y sus enlaces ya verificados (nunca inventados por la IA). */
export interface EntityLinks {
  query: string
  entity: { id: string; label: string; description: string | null } | null
  links: { site: LinkSite; url: string }[]
}

/** "Mi carpeta": lo que el servidor sabe de las canciones del dispositivo (nunca el audio). */
export interface FolderStatus {
  itemCount: number
  /** Canciones "por revisar": el nombre no está confirmado. */
  review: number
  /** Sin atributos de IA todavía. */
  unanalyzed: number
  /** Sin embedding todavía. */
  unembedded: number
  /** Sin medir el audio en el dispositivo (Essentia.js). */
  unmeasured?: number
}

/** Medición del audio hecha en el dispositivo; la API la convierte a atributos. */
export interface FolderAudioInput {
  key: string
  bpm: number
  tonic: string
  scale: 'major' | 'minor'
  keyStrength: number
  danceability: number
  loudnessDb: number
  dynamicComplexity: number
  seconds: number
  version: number
}

export interface FolderTrack {
  id: string
  key: string
  title: string
  artist: string | null
  review: boolean
  manual: boolean
  identified: string
}

export interface FolderTrackInput {
  key: string
  fileName: string
  title?: string | null
  artist?: string | null
  durationSec?: number | null
}

/** Progreso de la importación de la música de YouTube. */
export interface YouTubeImport {
  status: 'running' | 'done' | 'error'
  step: string
  found: number
  added: number
  analyzed: number
  embedded: number
  pending: number
  quotaUnits: number
  likedMusicPlaylist?: 'ok' | 'unavailable'
  error?: string
  startedAt: string
  finishedAt?: string
}

/** Una lista propia de YouTube, para elegir cuáles importar (las más recientes primero). */
export interface YouTubePlaylistInfo {
  id: string
  title: string
  itemCount: number
  publishedAt: string | null
  thumbnail: string | null
  /** Cuándo se importó por última vez (null: nunca) y cuántas canciones trajo. */
  importedAt: string | null
  songs: number | null
}

export interface YouTubeStatus {
  /** Si el servidor tiene cliente OAuth de Google. */
  configured: boolean
  /** `expired`: Google pide volver a conectar (cada 7 días en modo de pruebas). */
  status: 'disconnected' | 'connected' | 'expired'
  channelTitle: string | null
  connectedAt: string | null
  expiresAt: string | null
  itemCount: number
  import: YouTubeImport | null
}

export interface SavedPlaylist {
  playlistId: string
  url: string
  added: number
  failed: number
  existing: boolean
}

export interface SimilarItems {
  itemId: string
  /** Vecinos por embedding del mismo dominio, con su similitud coseno (0–1). */
  items: { similarity: number; item: Item }[]
}

export interface ItemPage {
  total: number
  items: Item[]
}

export type TuningEvent =
  | { step: 'profile'; profile: MoodProfile }
  | { step: 'candidates'; count: number; total: number }
  | { step: 'fit'; checked: number; total: number }
  | { step: 'explain' }
  | { step: 'done'; sessionId: string }
  | { step: 'error'; message: string }

export type Feedback = 'up' | 'down'

/** Un gusto: etiqueta del catálogo o grupo (`@rpg`), con su nombre legible. */
export interface TasteEntry {
  id: string
  label: string
}

export interface Taste {
  domainId: string
  /** Si ya pasó por el onboarding de esta temática (o lo saltó). */
  onboarded: boolean
  likes: TasteEntry[]
  dislikes: TasteEntry[]
  /** Lo aprendido con los 👍/👎 (peso −1 a 1). */
  learned: (TasteEntry & { weight: number })[]
  feedback: Record<string, Feedback>
  preferences: Record<string, string>
  vocabulary: { groups: TasteEntry[]; tags: (TasteEntry & { count: number })[] }
}

export class ApiError extends Error {
  readonly status: number
  /** Código de error de la API (p. ej. `youtube_reconnect`). */
  readonly code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...userHeaders(), ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.message ?? `Error ${res.status}`, body.code)
  }
  return res.json() as Promise<T>
}

/** Tema propuesto por la IA con el contraste ya comprobado; `notices` lista lo que se corrigió. */
export interface GeneratedTheme {
  theme: ResolvedTheme
  notices: string[]
}

/** Valoración de algo ya visto, leído, jugado o escuchado. */
export type SeenRating = 'loved' | 'liked' | 'meh'

export interface SeenEntry {
  item: Item
  rating: SeenRating | null
  source: string
  seenAt: string
}

export interface SeenList {
  domainId: string
  total: number
  entries: SeenEntry[]
}

/** Importación de historial (Letterboxd, Goodreads, Steam) como «ya visto». */
export interface HistoryImport {
  id: string
  domainId: string
  source: 'letterboxd' | 'goodreads' | 'steam'
  status: 'running' | 'done'
  total: number
  processed: number
  found: number
  added: number
  notFound: number
  missing: string[]
}

export type YearCardKind = 'intro' | 'domains' | 'rated' | 'creators' | 'words' | 'vibe' | 'facts'

/** «Tu año en Sintonía»: solo datos guardados; la IA, como mucho, redacta los titulares. */
export interface YearSummary {
  year: number
  empty: boolean
  totals: { sessions: number; recommended: number; seen: number; rated: number; domains: number }
  domains: { id: string; name: string; sessions: number; seen: number }[]
  topRated: { domainId: string; title: string; subtitle: string | null; imageUrl: string | null; rating: SeenRating }[]
  creators: { domainId: string; name: string; count: number }[]
  words: { word: string; count: number }[]
  vibe: { domainId: string; name: string; sessions: number; bars: { key: string; label: string; value: number; word: string | null }[] } | null
  facts: string[]
}

export interface YearView {
  summary: YearSummary
  cards: { kind: YearCardKind; headline: string }[]
}

export const api = {
  getYear: () => request<YearView>('/year'),
  /** Tarjeta como PNG 9:16 (Satori en la API). */
  getYearCard: async (kind: YearCardKind) => {
    const res = await fetch(`/api/year/card/${kind}`, { headers: userHeaders() })
    if (!res.ok) throw new ApiError(res.status, `Error ${res.status}`)
    return res.blob()
  },
  getHistoryImport: (domainId: string) => request<{ import: HistoryImport | null }>(`/history/${domainId}`).then((r) => r.import),
  /** El CSV va tal cual (`text/csv`): se lee en el servidor y no se guarda. */
  startHistoryCsv: (domainId: string, csv: string) =>
    request<HistoryImport>(`/history/${domainId}`, { method: 'POST', body: csv, headers: { 'content-type': 'text/csv' } }),
  startHistorySteam: (domainId: string, steam: string) => request<HistoryImport>(`/history/${domainId}`, { method: 'POST', body: JSON.stringify({ steam }) }),
  stepHistory: (id: string) => request<HistoryImport>(`/history/step/${id}`, { method: 'POST' }),
  /** «Ya visto» de una temática. */
  getSeen: (domainId: string) => request<SeenList>(`/seen/${domainId}`),
  markSeen: (domainId: string, itemId: string, rating: SeenRating | null) =>
    request<{ itemId: string; rating: SeenRating | null }>(`/seen/${domainId}/${itemId}`, { method: 'PUT', body: JSON.stringify({ rating }) }),
  unmarkSeen: (domainId: string, itemId: string) => request<{ itemId: string }>(`/seen/${domainId}/${itemId}`, { method: 'DELETE' }),
  /** "Para saber más" sobre una franquicia, saga, autor, estudio o artista. */
  getLinks: (domainId: string, entity: string) => request<EntityLinks>(`/links?${new URLSearchParams({ domain: domainId, entity })}`),
  /** "Para saber más" de una lista: sobre lo concreto que se pidió en su entrevista ("Marvel"). */
  getSessionLinks: (sessionId: string) => request<EntityLinks>(`/links?${new URLSearchParams({ session: sessionId })}`),
  /** «Hoy para ti»: contexto, combo de esta noche y actividad por temática. */
  getHome: (client: ClientContext) => request<HomeSummary>('/home', { method: 'POST', body: JSON.stringify({ client }) }),
  /** A qué temática lleva lo escrito en la barra universal (el texto no se guarda). */
  routeIntent: (text: string) => request<RouteIntentResult>('/route-intent', { method: 'POST', body: JSON.stringify({ text }) }),
  /** «Tu historia»: calendario, top, lo aprendido y la IA en números de esta persona. */
  getStory: () => request<StoryView>('/story'),
  /** Genera un tema a partir de una descripción (no se guarda). `variant` > 0 pide otra versión. */
  generateTheme: (description: string, variant = 0) =>
    request<GeneratedTheme>('/themes/generate', { method: 'POST', body: JSON.stringify({ description, variant }) }),
  /** Buzón: un comentario, idea o error con la pantalla, la temática y sus imágenes (ya comprimidas). */
  sendFeedback: (body: { kind: FeedbackKind; message: string; screen?: string; domainId?: string; context?: Record<string, string | number>; images: FeedbackImage[] }) =>
    request<{ id: string }>('/feedback', { method: 'POST', body: JSON.stringify(body) }),
  /** Avisa al servidor de que esta persona desbloqueó el Modo Perreo (sin la frase). */
  unlockSecret: () => request<{ ok: boolean }>('/domains/unlock', { method: 'POST' }),
  getDomains: () => request<DomainInfo[]>('/domains?hidden=1'),
  /** Modo Perreo: explorador de artistas (filtros y orden) y ficha. */
  perreoArtists: (query: string) => request<PerreoArtistList>(`/perreo/artists${query ? `?${query}` : ''}`),
  perreoReview: () => request<PerreoReview>('/perreo/review'),
  perreoDecide: (id: string, decision: 'accept' | 'reject' | 'undo') =>
    request<{ id: string; status: string }>(`/perreo/review/${encodeURIComponent(id)}`, { method: 'POST', body: JSON.stringify({ decision }) }),
  perreoEdit: (slug: string, patch: PerreoArtistPatch) =>
    request<PerreoArtistDetail>(`/perreo/artists/${encodeURIComponent(slug)}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  perreoArtist: (slug: string) => request<PerreoArtistDetail>(`/perreo/artists/${encodeURIComponent(slug)}`),
  /** «Mi YouTube» enlazado con los artistas (vacío sin el Modo Perreo desbloqueado). */
  perreoYouTube: () => request<PerreoYouTube>('/perreo/youtube'),
  /** «En tu YouTube»: las canciones guardadas en las que sale el artista. */
  perreoArtistYouTube: (slug: string) => request<Item[]>(`/perreo/artists/${encodeURIComponent(slug)}/youtube`),
  /** El pulso del Modo Perreo (lo precalcula `pnpm perreo:pulse`). */
  perreoReleases: (query: string) => request<PerreoReleases>(`/perreo/releases?${query}`),
  perreoHot: (query: string) => request<PerreoHot>(`/perreo/hot?${query}`),
  perreoCompare: (slugs: string) => request<PerreoCompare>(`/perreo/compare?${new URLSearchParams({ slugs })}`),
  /** `initialText` es el punto de partida opcional (texto o voz) antes de las preguntas. */
  startSession: (
    domainId: string,
    options: { initialText?: string; client?: ClientContext; preferences?: Record<string, string>; tasteOff?: string[]; understanding?: EditedUnderstanding } = {},
  ) => request<SessionView>('/sessions', { method: 'POST', body: JSON.stringify({ domainId, ...options }) }),
  /** Lo que se entiende del texto, sin crear la sesión (el texto no se guarda). */
  understand: (domainId: string, text: string) =>
    request<Understanding>('/sessions/understand', { method: 'POST', body: JSON.stringify({ domainId, text }) }),
  getSession: (id: string) => request<SessionView>(`/sessions/${id}`),
  /** `step` es el número de la pregunta que se responde: el servidor rechaza (409) los dobles envíos. */
  answer: (id: string, answer: Answer, step?: number) =>
    request<SessionView>(`/sessions/${id}/answers`, { method: 'POST', body: JSON.stringify({ answer, step }) }),
  /** Respuesta libre a la pregunta pendiente: se entiende en el servidor y no se guarda. */
  reply: (id: string, text: string, step?: number) =>
    request<SessionView>(`/sessions/${id}/reply`, { method: 'POST', body: JSON.stringify({ text, step }) }),
  undo: (id: string) => request<SessionView>(`/sessions/${id}/undo`, { method: 'POST' }),
  getResult: (id: string) => request<SessionResult>(`/sessions/${id}/result`),
  /** Reordena la lista dentro de la bolsa con las barras movidas (sin IA). Sin `scales`, vuelve a la original. */
  /** Guarda el orden y los elementos de la lista (editar). */
  saveEntries: (id: string, itemIds: string[]) =>
    request<SessionResult>(`/sessions/${id}/entries`, { method: 'PUT', body: JSON.stringify({ itemIds }) }),
  revibe: (id: string, scales?: Record<string, number>) =>
    request<SessionResult>(`/sessions/${id}/vibe`, { method: 'POST', body: JSON.stringify({ scales }) }),
  getSimilar: (itemId: string, limit = 10) => request<SimilarItems>(`/items/${itemId}/similar?limit=${limit}`),
  getItem: (itemId: string) => request<Item>(`/items/${itemId}`),
  /** Detalles del elemento; en música completa los créditos desde MusicBrainz la primera vez. */
  getDetails: (itemId: string) => request<ItemDetails>(`/items/${itemId}/details`),
  /** Biblioteca de un dominio: búsqueda por título o autor y filtro por etiquetas. */
  browse: (domainId: string, options: { q?: string; tags?: string[]; offset?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams()
    if (options.q) qs.set('q', options.q)
    if (options.tags?.length) qs.set('tags', options.tags.join(','))
    qs.set('offset', String(options.offset ?? 0))
    qs.set('limit', String(options.limit ?? 24))
    return request<ItemPage>(`/domains/${domainId}/items?${qs}`)
  },

  getTaste: (domainId: string) => request<Taste>(`/taste/${domainId}`),
  saveTaste: (domainId: string, body: { likes: string[]; dislikes: string[]; preferences?: Record<string, string> }) =>
    request<Taste>(`/taste/${domainId}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTaste: (domainId: string) => request<{ deleted: boolean }>(`/taste/${domainId}`, { method: 'DELETE' }),
  /** 👍/👎 sobre un elemento (`null` la quita). */
  feedback: (domainId: string, itemId: string, value: Feedback | null) =>
    request<Taste>(`/taste/${domainId}/feedback`, { method: 'POST', body: JSON.stringify({ itemId, value }) }),
  /** Texto libre → gustos del catálogo. No guarda nada. */
  interpretTaste: (domainId: string, text: string) =>
    request<{ likes: TasteEntry[]; dislikes: TasteEntry[] }>(`/taste/${domainId}/interpret`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  folderStatus: () => request<FolderStatus>('/folder/status'),
  folderKeys: () => request<string[]>('/folder/keys'),
  folderTracks: () => request<FolderTrack[]>('/folder/tracks'),
  folderAdd: (tracks: FolderTrackInput[]) =>
    request<{ saved: number; review: number }>('/folder/tracks', { method: 'POST', body: JSON.stringify({ tracks }) }),
  folderCorrect: (id: string, body: { title: string; artist: string | null }) =>
    request<FolderTrack>(`/folder/tracks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  folderResume: () => request<FolderStatus & { quota: boolean }>('/folder/resume', { method: 'POST' }),
  folderAudioPending: () => request<string[]>('/folder/audio/pending'),
  folderAudio: (measurements: FolderAudioInput[]) =>
    request<{ saved: number }>('/folder/audio', { method: 'POST', body: JSON.stringify({ measurements }) }),
  folderForget: () => request<{ removed: number }>('/folder', { method: 'DELETE' }),

  opsPanel: (session: string | null) => request<OpsPanel>(`/ops/panel${session ? `?session=${session}` : ''}`),
  opsTraces: (session: string, since?: string) =>
    request<{ rows: TraceRow[] }>(`/ops/traces?session=${session}${since ? `&since=${encodeURIComponent(since)}` : ''}`),
  opsCompare: (session: string) => request<CompareResult>('/ops/compare', { method: 'POST', body: JSON.stringify({ session }) }),
  opsJudge: (session: string) => request<Judgement>('/ops/judge', { method: 'POST', body: JSON.stringify({ session }) }),

  youtubeStatus: () => request<YouTubeStatus>('/youtube/status'),
  /** URL de consentimiento de Google; el `state` queda ligado a este navegador con una cookie. */
  youtubeAuth: () => request<{ url: string }>('/youtube/auth', { method: 'POST' }),
  youtubeImport: (playlistIds?: string[]) =>
    request<YouTubeStatus>('/youtube/import', { method: 'POST', body: JSON.stringify(playlistIds ? { playlistIds } : {}) }),
  youtubePlaylists: () => request<{ playlists: YouTubePlaylistInfo[] }>('/youtube/playlists'),
  youtubeDisconnect: () => request<{ disconnected: boolean; removed: number }>('/youtube', { method: 'DELETE' }),
  /** Crea la lista del resultado en la cuenta de YouTube (privada por defecto). */
  saveToYouTube: (sessionId: string, privacy: 'private' | 'unlisted' | 'public' = 'private') =>
    request<SavedPlaylist>('/youtube/playlists', { method: 'POST', body: JSON.stringify({ sessionId, privacy }) }),

  /** Sigue el progreso de Afinando por Server-Sent Events. Devuelve la función para cancelar. */
  tune(id: string, refine: string[], onEvent: (e: TuningEvent) => void, size?: { min: number; max: number }): () => void {
    const params = new URLSearchParams()
    if (refine.length) params.set('refine', refine.join(','))
    if (size) {
      params.set('min', String(size.min))
      params.set('max', String(size.max))
    }
    const qs = params.size ? `?${params}` : ''
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
