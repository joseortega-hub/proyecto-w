import { useQuery } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { buildTheme, themeCss, type ThemeProposal } from '@sintonia/tokens/engine'
import { api } from './api'
import { filtersToQuery, type PerreoFilters } from './perreo-types'
import { applyTheme } from './theme'

// --------------------------- Desbloqueo (solo en este dispositivo) ---------------------------
// Se guarda qué artista desbloqueó la persona y cómo escribió la frase (para mostrar el apodo).
// Las frases no están en el código (solo sus hashes): el apodo sale de lo que ella misma escribió.
const KEY = 'sintonia.perreo'

export interface PerreoUnlock {
  slug: string
  /** El apodo tal como lo escribió la persona, con mayúsculas bonitas. */
  nickname: string
}

const listeners = new Set<() => void>()
let cached: { raw: string | null; value: PerreoUnlock | null } = { raw: null, value: null }

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return memory
  }
}
let memory: string | null = null

export function readUnlock(): PerreoUnlock | null {
  const raw = readRaw()
  if (raw === cached.raw) return cached.value
  let value: PerreoUnlock | null = null
  try {
    const parsed = JSON.parse(raw ?? 'null') as Partial<PerreoUnlock> | null
    if (parsed && typeof parsed.slug === 'string' && /^[a-z0-9-]{2,40}$/.test(parsed.slug)) {
      value = { slug: parsed.slug, nickname: String(parsed.nickname ?? '').slice(0, 60) }
    }
  } catch {
    /* valor corrupto: como si no hubiera desbloqueo */
  }
  cached = { raw, value }
  return value
}

export function saveUnlock(unlock: PerreoUnlock) {
  const raw = JSON.stringify(unlock)
  memory = raw
  try {
    localStorage.setItem(KEY, raw)
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
  listeners.forEach((l) => l())
}

export function clearUnlock() {
  memory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nada que borrar */
  }
  listeners.forEach((l) => l())
}

export function usePerreoUnlock(): PerreoUnlock | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      window.addEventListener('storage', cb)
      return () => {
        listeners.delete(cb)
        window.removeEventListener('storage', cb)
      }
    },
    readUnlock,
    () => null,
  )
}

/** «dale mami» → «Dale Mami». */
export const prettyNickname = (typed: string) =>
  typed
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)(\p{L})/gu, (_m, space: string, letter: string) => space + letter.toUpperCase())
    .slice(0, 60)

// --------------------------- Datos ---------------------------
export function usePerreoArtists(filters: PerreoFilters) {
  const query = filtersToQuery(filters)
  return useQuery({ queryKey: ['perreo', 'artists', query], queryFn: () => api.perreoArtists(query), staleTime: 5 * 60_000, placeholderData: (prev) => prev })
}

export function usePerreoArtist(slug: string | undefined) {
  return useQuery({ queryKey: ['perreo', 'artist', slug], queryFn: () => api.perreoArtist(slug!), enabled: !!slug, staleTime: 5 * 60_000 })
}

export function usePerreoReview() {
  return useQuery({ queryKey: ['perreo', 'review'], queryFn: api.perreoReview, staleTime: 60_000 })
}

export const photoUrl = (slug: string) => `/api/perreo/artists/${encodeURIComponent(slug)}/photo`

// --------------------------- Tema neón ---------------------------
// Se construye con el motor de temas: el contraste AA queda garantizado como en cualquier otro tema.
export const NEON_PROPOSAL: ThemeProposal = {
  name: 'Neón',
  radius: 14,
  shadow: 'brillo',
  font: 'space-grotesk',
  light: { background: '#fff4fd', foreground: '#1d0b24', card: '#ffffff', primary: '#c4137f', 'primary-foreground': '#ffffff', secondary: '#f6e3f4', 'muted-foreground': '#6b4a6e', accent: '#fbd6f0', 'accent-foreground': '#7d0b50', border: '#ecc9e6' },
  dark: { background: '#0b0613', foreground: '#f8eefe', card: '#16091f', primary: '#ff4fd0', 'primary-foreground': '#12041a', secondary: '#221030', 'muted-foreground': '#b79bc6', accent: '#3a0f3d', 'accent-foreground': '#ffb3ec', border: '#3a1d4d' },
}
const THEME_ID = 'perreo'
const STYLE_ID = 'tema-perreo'

/** Activa el tema neón (siempre oscuro) mientras `active`; al salir devuelve el tema de la persona. */
export function useNeonTheme(active: boolean) {
  useEffect(() => {
    if (!active) return
    const { theme } = buildTheme(NEON_PROPOSAL)
    let el = document.getElementById(STYLE_ID)
    if (!el) {
      el = document.createElement('style')
      el.id = STYLE_ID
      document.head.append(el)
    }
    el.textContent = themeCss(THEME_ID, theme)
    void import('@fontsource-variable/space-grotesk')
    const root = document.documentElement
    root.classList.add('dark')
    root.dataset.theme = THEME_ID
    root.dataset.perreo = 'on'
    return () => {
      delete root.dataset.perreo
      el?.remove()
      applyTheme()
    }
  }, [active])
}
