// Utilidades sin DOM del formulario de edición de artistas del Modo Perreo.

/**
 * Codifica la foto en base64 pequeño. Safari (iPhone) no sabe codificar WebP en un canvas
 * y devuelve PNG, que pesa diez veces más: en ese caso se usa JPEG.
 */
export function compactPhoto(encode: (type: string, quality: number) => string): string {
  const webp = encode('image/webp', 0.7)
  const url = webp.startsWith('data:image/webp') ? webp : encode('image/jpeg', 0.8)
  return url.split(',')[1]
}

type Links = { instagram: string; youtubeMusic: string; spotify: string }

/** Solo los enlaces que la persona ha cambiado: los importados que no toca no se validan ni se reescriben. */
export function changedLinks(original: Partial<Record<keyof Links, string>>, edited: Links): Partial<Links> | undefined {
  const out: Partial<Links> = {}
  for (const k of Object.keys(edited) as (keyof Links)[]) {
    const v = edited[k].trim()
    if (v !== (original[k] ?? '').trim()) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}
