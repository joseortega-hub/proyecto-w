import { useCallback, useSyncExternalStore } from 'react'
import themesJson from '@sintonia/tokens/themes.json'
import { deleteCustomTheme, injectCustomStyles, loadCustomThemes, PREVIEW_ID, previewInfo, saveCustomTheme, setPreviewCss, type CustomTheme, type ThemeDraft } from './custom-themes'

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

let draft: ThemeDraft | null = null
/** Los de serie, los tres propios guardados y, si la hay, la vista previa del que se está creando. */
export const allThemes = (): ThemeInfo[] => [...THEMES, ...loadCustomThemes(), ...(draft ? [previewInfo(draft)] : [])]

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
  if (draft) return PREVIEW_ID
  const v = read(PALETTE_KEY)
  return allThemes().some((t) => t.id === v) ? v! : DEFAULT_PALETTE
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
  for (const f of allThemes().find((t) => t.id === id)?.fonts ?? []) {
    if (!loadedFonts.has(f)) loadedFonts.set(f, FONT_LOADERS[f]?.().catch(() => loadedFonts.delete(f)) ?? Promise.resolve())
  }
}

/** Aplica tema y modo en <html> (data-theme y .dark) y actualiza el color de la barra del navegador. */
export function applyTheme(theme = currentTheme(), palette = currentPalette()) {
  injectCustomStyles()
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = palette
  preloadThemeFonts(palette)
  const color = allThemes().find((t) => t.id === palette)?.modes[theme].themeColor
  if (color) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    if (palette !== PREVIEW_ID) write(COLOR_KEY, color)
  }
}

const listeners = new Set<() => void>()
const notify = () => {
  version++
  listeners.forEach((l) => l())
}
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

let version = 0
const snapshot = () => `${currentMode()}|${currentTheme()}|${currentPalette()}|${version}`

export function useTheme() {
  const [mode, theme, palette] = useSyncExternalStore(subscribe, snapshot, () => `system|light|${DEFAULT_PALETTE}|0`).split('|') as [
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
  /** Vista previa de un tema recién generado (null la quita): se ve al instante pero no se guarda. */
  const setDraft = useCallback((next: ThemeDraft | null) => {
    draft = next
    setPreviewCss(next?.theme ?? null)
    applyTheme()
    notify()
  }, [])
  /** Guarda la vista previa como tema propio y lo activa. Devuelve null si ya hay 3. */
  const saveDraft = useCallback((description: string): CustomTheme | null => {
    if (!draft) return null
    const saved = saveCustomTheme(draft, description)
    if (!saved) return null
    draft = null
    setPreviewCss(null)
    write(PALETTE_KEY, saved.id)
    applyTheme()
    notify()
    return saved
  }, [])
  const removeCustom = useCallback((id: string) => {
    deleteCustomTheme(id)
    if (read(PALETTE_KEY) === id) write(PALETTE_KEY, null)
    applyTheme()
    notify()
  }, [])
  const toggle = useCallback(() => setMode(currentTheme() === 'dark' ? 'light' : 'dark'), [setMode])
  return { theme, mode, palette, themes: [...THEMES, ...loadCustomThemes()], customs: loadCustomThemes(), setMode, setPalette, setDraft, saveDraft, removeCustom, toggle }
}
