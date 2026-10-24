import type { VibeGradient } from './vibe-color'
import type { VibeTitle } from './vibe-title'

export interface VibeShareData {
  title: VibeTitle
  gradient: VibeGradient
  /** Palabra de cada dimensión ("muy tranquila") y su valor 0–1, para dibujar las barras. */
  bars: { label: string; value: number; word: string }[]
  /** Las 3 primeras de la lista. */
  top: string[]
  brand: string
  listTitle: string
}

const W = 1080
const H = 1350
const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif'

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

/**
 * Dibuja la tarjeta para compartir: nombre, degradado, barras y las 3 primeras de la lista.
 * Solo lleva datos del catálogo público: nunca el texto ni las respuestas de la persona.
 */
export async function renderVibeCard(data: VibeShareData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Este navegador no puede dibujar la imagen')
  const { gradient, title } = data

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, gradient.from)
  bg.addColorStop(1, gradient.to)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = gradient.ink
  ctx.textBaseline = 'alphabetic'

  ctx.font = `700 34px ${FONT}`
  ctx.fillText('TU VIBRA', 80, 130)

  ctx.font = `160px ${FONT}`
  ctx.fillText(title.emoji, 80, 330)

  ctx.font = `800 92px ${FONT}`
  const lines = wrap(ctx, title.text, W - 160)
  lines.forEach((l, i) => ctx.fillText(l, 80, 450 + i * 100))
  let y = 450 + (lines.length - 1) * 100
  if (title.context) {
    ctx.font = `600 38px ${FONT}`
    ctx.fillText(title.context, 80, y + 70)
    y += 70
  }

  // Barras: una por dimensión, con la palabra debajo.
  const barsTop = y + 110
  const barH = 190
  const colW = (W - 160) / Math.max(1, data.bars.length)
  data.bars.forEach((b, i) => {
    const x = 80 + i * colW + colW / 2
    const w = Math.min(54, colW - 18)
    ctx.globalAlpha = 0.22
    ctx.fillStyle = gradient.ink
    ctx.beginPath()
    ctx.roundRect(x - w / 2, barsTop, w, barH, 12)
    ctx.fill()
    ctx.globalAlpha = 1
    const h = Math.max(14, barH * b.value)
    ctx.beginPath()
    ctx.roundRect(x - w / 2, barsTop + barH - h, w, h, 12)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.font = `700 24px ${FONT}`
    ctx.fillText(fit(ctx, b.label, colW - 6), x, barsTop + barH + 40)
    ctx.font = `500 19px ${FONT}`
    ctx.fillText(fit(ctx, b.word, colW - 6), x, barsTop + barH + 70)
    ctx.textAlign = 'left'
  })

  // Las 3 primeras de la lista, en una tarjeta clara.
  const cardY = barsTop + barH + 130
  const cardH = 60 + data.top.length * 66
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.roundRect(60, cardY, W - 120, cardH, 28)
  ctx.fill()
  ctx.fillStyle = gradient.ink
  ctx.font = `700 28px ${FONT}`
  ctx.fillText(data.listTitle.toUpperCase(), 100, cardY + 48)
  ctx.font = `600 38px ${FONT}`
  data.top.forEach((t, i) => ctx.fillText(fit(ctx, `${i + 1}. ${t}`, W - 200), 100, cardY + 108 + i * 66))

  ctx.font = `800 40px ${FONT}`
  ctx.fillText(data.brand, 80, H - 70)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No he podido crear la imagen'))), 'image/png'))
}

/** Comparte la imagen con la Web Share API; si el navegador no puede, la descarga. Devuelve cómo acabó. */
export async function shareVibeImage(blob: Blob, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], 'mi-vibra.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Mi vibra: ${title}`, text: `Mi vibra: ${title}` })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mi-vibra.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
