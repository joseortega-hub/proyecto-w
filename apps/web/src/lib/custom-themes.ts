// Temas propios generados con IA: se guardan solo en este dispositivo (localStorage), hasta 3.
// El script en línea de index.html lee `sintonia.custom-css` para aplicarlos antes de pintar.
import { menuModes, themeCss, type ResolvedTheme } from '@sintonia/tokens/engine'

export const MAX_CUSTOM = 3
export const PREVIEW_ID = 'ia-preview'
const THEMES_KEY = 'sintonia.custom-themes'
const CSS_KEY = 'sintonia.custom-css'
const STYLE_ID = 'tema-ia'

export type CustomTheme = {
  id: string
  label: string
  description: string
  fonts: string[]
  modes: Record<'light' | 'dark', { swatches: string[]; themeColor: string }>
  css: string
}

/** Un tema recién generado, aún sin guardar. */
export type ThemeDraft = { theme: ResolvedTheme; notices: string[] }

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* sin almacenamiento: el tema dura hasta recargar */
  }
}

export function loadCustomThemes(): CustomTheme[] {
  try {
    const list = JSON.parse(read(THEMES_KEY) ?? '[]') as CustomTheme[]
    return Array.isArray(list) ? list.filter((t) => /^ia-[1-3]$/.test(t.id) && t.css && t.modes).slice(0, MAX_CUSTOM) : []
  } catch {
    return []
  }
}

let previewCss = ''

/** Una sola hoja <style id="tema-ia" > con los temas guardados y, si hay, la vista previa. */
function syncStyle(saved: CustomTheme[]) {
  let el = document.getElementById(STYLE_ID)
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.append(el)
  }
  el.textContent = [...saved.map((t) => t.css), previewCss].filter(Boolean).join('\n')
}

export function injectCustomStyles() {
  syncStyle(loadCustomThemes())
}

export function setPreviewCss(theme: ResolvedTheme | null) {
  previewCss = theme ? themeCss(PREVIEW_ID, theme) : ''
  injectCustomStyles()
}

/** Datos de menú de un borrador (con el id de la vista previa). */
export function previewInfo(draft: ThemeDraft): CustomTheme {
  return { id: PREVIEW_ID, label: draft.theme.label, description: 'Vista previa', fonts: draft.theme.load, modes: menuModes(draft.theme), css: '' }
}

/** Guarda el borrador en un hueco libre. Devuelve null si ya hay 3. */
export function saveCustomTheme(draft: ThemeDraft, description: string): CustomTheme | null {
  const saved = loadCustomThemes()
  const slot = [1, 2, 3].map((n) => `ia-${n}`).find((id) => !saved.some((t) => t.id === id))
  if (!slot) return null
  const t: CustomTheme = {
    id: slot,
    label: draft.theme.label,
    description: description.slice(0, 80),
    fonts: draft.theme.load,
    modes: menuModes(draft.theme),
    css: themeCss(slot, draft.theme),
  }
  const next = [...saved, t]
  persist(next)
  return t
}

export function deleteCustomTheme(id: string) {
  persist(loadCustomThemes().filter((t) => t.id !== id))
}

function persist(list: CustomTheme[]) {
  write(THEMES_KEY, JSON.stringify(list))
  write(CSS_KEY, list.map((t) => t.css).join('\n'))
  syncStyle(list)
}
