import { useCallback, useSyncExternalStore } from 'react'
import themesJson from '@sintonia/tokens/themes.json'

/** Modo efectivo (claro u oscuro). */
export type Theme = 'light' | 'dark'
/** Preferencia de modo: la del sistema o una fija. */
export type ThemeMode = 'system' | Theme

export type ThemeInfo = {
  id: string
  label: string
  description: string
  inspiredBy?: string
  fonts: string[]
  modes: Record<Theme, { swatches: string[]; themeColor: string }>
}

export const THEMES = themesJson.themes as ThemeInfo[]
export const DEFAULT_PALETTE = themesJson.default

// Las mismas claves lee el script en línea de index.html antes de pintar: si cambian, cambiarlas allí también.
const MODE_KEY = 'sintonia.theme'
const PALETTE_KEY = 'sintonia.palette'
const COLOR_KEY = 'sintonia.theme-color'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* sin almacenamiento: el cambio dura hasta recargar */
  }
}

export function currentMode(): ThemeMode {
  const v = read(MODE_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

/** Modo efectivo: el elegido por la persona o, si no eligió, el del sistema. */
export function currentTheme(): Theme {
  const mode = currentMode()
  return mode === 'system' ? (media().matches ? 'dark' : 'light') : mode
}

export function currentPalette(): string {
  const v = read(PALETTE_KEY)
  return THEMES.some((t) => t.id === v) ? v! : DEFAULT_PALETTE
}

// Fuentes de cada tema: se descargan solo al elegirlo (o al pasar por encima en el menú).
const FONT_LOADERS: Record<string, () => Promise<unknown>> = {
  inter: () => import('@fontsource-variable/inter'),
  unbounded: () => import('@fontsource-variable/unbounded'),
  fraunces: () => import('@fontsource-variable/fraunces'),
  'space-grotesk': () => import('@fontsource-variable/space-grotesk'),
}
const loadedFonts = new Map<string, Promise<unknown>>()
export function preloadThemeFonts(id: string) {
  for (const f of THEMES.find((t) => t.id === id)?.fonts ?? []) {
    if (!loadedFonts.has(f)) loadedFonts.set(f, FONT_LOADERS[f]?.().catch(() => loadedFonts.delete(f)) ?? Promise.resolve())
  }
}

/** Aplica tema y modo en <html> (data-theme y .dark) y actualiza el color de la barra del navegador. */
export function applyTheme(theme = currentTheme(), palette = currentPalette()) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = palette
  preloadThemeFonts(palette)
  const color = THEMES.find((t) => t.id === palette)?.modes[theme].themeColor
  if (color) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    write(COLOR_KEY, color)
  }
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())
function subscribe(cb: () => void) {
  listeners.add(cb)
  const mq = media()
  const onChange = () => {
    applyTheme()
    cb()
  }
  mq.addEventListener('change', onChange)
  return () => {
    listeners.delete(cb)
    mq.removeEventListener('change', onChange)
  }
}

const snapshot = () => `${currentMode()}|${currentTheme()}|${currentPalette()}`

export function useTheme() {
  const [mode, theme, palette] = useSyncExternalStore(subscribe, snapshot, () => `system|light|${DEFAULT_PALETTE}`).split('|') as [
    ThemeMode,
    Theme,
    string,
  ]
  const setMode = useCallback((next: ThemeMode) => {
    write(MODE_KEY, next === 'system' ? null : next)
    applyTheme()
    notify()
  }, [])
  const setPalette = useCallback((next: string) => {
    write(PALETTE_KEY, next === DEFAULT_PALETTE ? null : next)
    applyTheme()
    notify()
  }, [])
  const toggle = useCallback(() => setMode(currentTheme() === 'dark' ? 'light' : 'dark'), [setMode])
  return { theme, mode, palette, setMode, setPalette, toggle }
}
