export interface SlotRect {
  top: number
  left: number
  width: number
  height: number
}

interface Measurable {
  getBoundingClientRect(): { top: number; left: number; width: number; height: number }
  checkVisibility?: (opts?: { checkOpacity?: boolean; checkVisibilityCSS?: boolean }) => boolean
}

/**
 * El hueco visible más grande dentro de la pantalla: el reproductor completo gana a la
 * miniatura. Un hueco oculto (display:none, visibility:hidden, opacidad 0) o fuera de la
 * pantalla no cuenta, para que el vídeo no se quede flotando donde ya no hay reproductor.
 */
export function pickSlot(slots: Measurable[], viewportWidth: number, viewportHeight: number): SlotRect | null {
  let best: SlotRect | null = null
  for (const slot of slots) {
    if (slot.checkVisibility && !slot.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue
    const { top, left, width, height } = slot.getBoundingClientRect()
    if (width <= 0 || height <= 0) continue
    if (top >= viewportHeight || left >= viewportWidth || top + height <= 0 || left + width <= 0) continue
    if (!best || width * height > best.width * best.height) best = { top, left, width, height }
  }
  return best
}

/** Compara a medio píxel: evita repintar en cada fotograma si el hueco no se ha movido. */
export function sameRect(a: SlotRect | null, b: SlotRect | null) {
  if (!a || !b) return a === b
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5
}
