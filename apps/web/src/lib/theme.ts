import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

const KEY = 'sintonia.theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

/** Tema efectivo: el elegido por la persona o, si no eligió, el del sistema. */
export function currentTheme(): Theme {
  return stored() ?? (media().matches ? 'dark' : 'light')
}

export function applyTheme(theme = currentTheme()) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

const listeners = new Set<() => void>()
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

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'light' as Theme)
  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* sin almacenamiento: el cambio dura hasta recargar */
    }
    applyTheme(next)
    listeners.forEach((l) => l())
  }, [])
  return { theme, toggle }
}
