export interface VibeAttribute {
  key: string
  label: string
  lowLabel?: string
  highLabel?: string
}

/** Palabras en vez de números: "muy tranquila", "término medio", "bailable". Una palabra sola admite "muy". */
export function levelWord(value: number, a: Pick<VibeAttribute, 'lowLabel' | 'highLabel'>): string {
  const low = a.lowLabel ?? 'poco'
  const high = a.highLabel ?? 'mucho'
  const very = (w: string) => (w.includes(' ') ? w : `muy ${w}`)
  if (value <= 0.15) return very(low)
  if (value <= 0.35) return low
  if (value < 0.65) return 'término medio'
  if (value < 0.85) return high
  return very(high)
}
