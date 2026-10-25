// Buzón de comentarios, ideas y errores. Las imágenes se comprimen en el navegador para que
// quepan en el cuerpo JSON de la API (1 MB): los mismos límites valida apps/api/src/feedback.

export type FeedbackKind = 'error' | 'idea' | 'mejora'

export const FEEDBACK_KINDS: { id: FeedbackKind; label: string; hint: string }[] = [
  { id: 'error', label: 'Error', hint: 'Algo no funciona como debería' },
  { id: 'idea', label: 'Idea', hint: 'Algo nuevo que te gustaría' },
  { id: 'mejora', label: 'Mejora', hint: 'Algo que ya existe, pero mejor' },
]

export const MAX_MESSAGE = 2000
export const MAX_IMAGES = 3
/** Caracteres base64 por imagen (~225 kB) y en total: por debajo del límite del servidor. */
export const MAX_IMAGE_CHARS = 300_000
export const MAX_TOTAL_IMAGE_CHARS = 800_000
/** Lado mayor de la imagen comprimida. */
export const MAX_SIDE = 1600

export interface FeedbackImage {
  type: 'image/jpeg' | 'image/webp' | 'image/png'
  /** Base64 sin el prefijo `data:`. */
  data: string
}

/** Tamaño que conserva la proporción y no pasa de `max` por el lado mayor (nunca amplía). */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Separa un data URL en tipo y base64. */
export function splitDataUrl(url: string): FeedbackImage | null {
  const m = /^data:(image\/(?:jpeg|webp|png));base64,(.+)$/.exec(url)
  return m ? { type: m[1] as FeedbackImage['type'], data: m[2] } : null
}

/** Qué falta o sobra antes de enviar (null si está bien). */
export function feedbackProblem(input: { message: string; images: FeedbackImage[] }): string | null {
  const text = input.message.trim()
  if (text.length < 3) return 'Cuéntanos un poco más.'
  if (text.length > MAX_MESSAGE) return `El texto pasa de ${MAX_MESSAGE} caracteres.`
  if (input.images.length > MAX_IMAGES) return `Como mucho ${MAX_IMAGES} imágenes.`
  if (input.images.some((i) => i.data.length > MAX_IMAGE_CHARS)) return 'Alguna imagen es demasiado grande.'
  if (input.images.reduce((n, i) => n + i.data.length, 0) > MAX_TOTAL_IMAGE_CHARS) return 'Las imágenes ocupan demasiado entre todas. Quita alguna.'
  return null
}

/** Calidades que se prueban, de más a menos, hasta que la imagen cabe. */
const QUALITIES = [0.82, 0.7, 0.58, 0.45]

/**
 * Comprime una captura o foto: la reduce a {@link MAX_SIDE} px, la pasa a WebP (o JPEG si el
 * navegador no sabe) y baja la calidad hasta que cabe; si aun así no cabe, la reduce más.
 */
export async function compressImage(file: Blob): Promise<FeedbackImage> {
  if (!file.type.startsWith('image/')) throw new Error('Solo se pueden adjuntar imágenes.')
  const bitmap = await createImageBitmap(file)
  try {
    for (const side of [MAX_SIDE, 1200, 900]) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, side)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Tu navegador no puede preparar la imagen.')
      ctx.drawImage(bitmap, 0, 0, width, height)
      for (const quality of QUALITIES) {
        let image = splitDataUrl(canvas.toDataURL('image/webp', quality))
        if (!image || image.type !== 'image/webp') image = splitDataUrl(canvas.toDataURL('image/jpeg', quality))
        if (image && image.data.length <= MAX_IMAGE_CHARS) return image
      }
    }
  } finally {
    bitmap.close()
  }
  throw new Error('La imagen es demasiado grande, incluso comprimida.')
}

/** Contexto automático: tamaño de pantalla, estructura, estilo y navegador. Nada personal. */
export function feedbackContext(): Record<string, string | number> {
  const root = document.documentElement
  return {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: Math.round(window.devicePixelRatio * 100) / 100,
    theme: root.dataset.theme ?? '',
    mode: root.classList.contains('dark') ? 'oscuro' : 'claro',
    layout: (() => {
      try {
        return localStorage.getItem('sintonia.layout') ?? 'app'
      } catch {
        return 'app'
      }
    })(),
    agent: navigator.userAgent.slice(0, 300),
  }
}

/** Temática a partir de la ruta ("/games/biblioteca/1" → "games"); las globales no tienen. */
export function domainFromPath(pathname: string, domainIds: string[]): string | undefined {
  const first = pathname.split('/')[1]
  return first && domainIds.includes(first) ? first : undefined
}

const OPEN_EVENT = 'sintonia:feedback'
/** Abre el buzón desde cualquier sitio (menú, barra lateral…). */
export const openFeedback = () => window.dispatchEvent(new Event(OPEN_EVENT))
export const onOpenFeedback = (cb: () => void) => {
  window.addEventListener(OPEN_EVENT, cb)
  return () => window.removeEventListener(OPEN_EVENT, cb)
}
