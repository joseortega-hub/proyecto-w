// Utilidades sin DOM del formulario de edición de artistas del Modo Perreo.

/**
 * Foto de un artista. Se cachea un día, así que lleva la huella que da el servidor:
 * al cambiar la foto cambia la URL y el navegador (en cualquier dispositivo) pide la nueva.
 */
export const photoUrl = (artist: { slug: string; photoV?: string | null }) =>
  `/api/perreo/artists/${encodeURIComponent(artist.slug)}/photo${artist.photoV ? `?v=${artist.photoV}` : ''}`

/**
 * Codifica la foto en base64 pequeño. Safari (iPhone) no sabe codificar WebP en un canvas
 * y devuelve PNG, que pesa diez veces más: en ese caso se usa JPEG.
 */
export function compactPhoto(encode: (type: string, quality: number) => string): string {
  const webp = encode('image/webp', 0.7)
  const url = webp.startsWith('data:image/webp') ? webp : encode('image/jpeg', 0.8)
  return url.split(',')[1]
}

/** Solo los enlaces que la persona ha cambiado: los importados que no toca no se validan ni se reescriben. */
export function changedLinks<K extends string>(original: Partial<Record<K, string>>, edited: Record<K, string>): Partial<Record<K, string>> | undefined {
  const out: Partial<Record<K, string>> = {}
  for (const k of Object.keys(edited) as K[]) {
    const v = edited[k].trim()
    if (v !== (original[k] ?? '').trim()) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

type Label = { name: string; start: number | null; end: number | null }

/** «Rimas (2016–2020)» → { name: 'Rimas', start: 2016, end: 2020 }. Sin años, se conservan los que ya tuviera. */
export function parseLabelLines(text: string, previous: Label[] = []): Label[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.*?)\s*\((\d{4})?\s*[-–]?\s*(\d{4}|hoy)?\)\s*$/i)
      if (!m || (!m[2] && !m[3])) {
        const old = previous.find((l) => l.name === line)
        return { name: line, start: old?.start ?? null, end: old?.end ?? null }
      }
      return { name: m[1].trim(), start: m[2] ? Number(m[2]) : null, end: m[3] && m[3].toLowerCase() !== 'hoy' ? Number(m[3]) : null }
    })
    .filter((l) => l.name)
}

/** Lo contrario: una línea por sello, con sus años si los hay. */
export const labelLines = (labels: Label[]) =>
  labels.map((l) => (l.start || l.end ? `${l.name} (${l.start ?? ''}–${l.end ?? 'hoy'})` : l.name)).join('\n')

/** Una por línea, sin repetidas (sin distinguir mayúsculas). */
export const lines = (text: string) => {
  const seen = new Set<string>()
  return text
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x && !seen.has(x.toLowerCase()) && !!seen.add(x.toLowerCase()))
}
