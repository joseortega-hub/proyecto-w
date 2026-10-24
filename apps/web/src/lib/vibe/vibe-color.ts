import { contrast, oklch } from '@sintonia/tokens/engine'

/** Tinta oscura fija: texto sobre el degradado, igual en todos los temas y en la imagen de compartir. */
export const VIBE_INK = '#15131f'
const MIN_CONTRAST = 4.5

export interface VibeGradient {
  from: string
  to: string
  ink: string
  hue: number
  /** Contraste más bajo entre la tinta y los dos extremos (siempre ≥ 4,5). */
  contrast: number
  css: string
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Tono según la positividad: azul (melancólica) → magenta → naranja (alegre). */
export const vibeHue = (positivity: number) => (260 + 150 * clamp01(positivity)) % 360

/**
 * Degradado propio de la vibra en OKLCH con el motor de color compartido: el tono sale de la
 * positividad y el croma de la intensidad. La luminosidad sube hasta que la tinta oscura
 * llega a AA sobre los dos extremos, así que el texto encima siempre se lee.
 */
export function vibeGradient(intensity: number, positivity: number): VibeGradient {
  const hue = vibeHue(positivity)
  const chroma = 0.05 + 0.13 * clamp01(intensity)
  const stops = (L: number) => [oklch(L, chroma, (hue - 24 + 360) % 360), oklch(L - 0.04, chroma, (hue + 24) % 360)] as const
  let L = 0.72
  let [from, to] = stops(L)
  for (let i = 0; i < 40 && Math.min(contrast(VIBE_INK, from), contrast(VIBE_INK, to)) < MIN_CONTRAST; i++) {
    L += 0.01
    ;[from, to] = stops(L)
  }
  return {
    from,
    to,
    ink: VIBE_INK,
    hue,
    contrast: Math.min(contrast(VIBE_INK, from), contrast(VIBE_INK, to)),
    css: `linear-gradient(135deg, ${from}, ${to})`,
  }
}
