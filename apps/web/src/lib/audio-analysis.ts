// Análisis real del audio de "Mi carpeta" en el dispositivo: la página decodifica un tramo
// (Web Audio) y un worker lo mide con Essentia.js. El audio nunca sale del navegador.
import type { AnalyzeRequest, AnalyzeResponse, AudioDescriptors } from './audio-analysis.types'

export type { AudioDescriptors }

/** Debe coincidir con `AUDIO_VERSION` de la API. */
export const AUDIO_VERSION = 1
/** Frecuencia del análisis: suficiente para tempo y tonalidad, y la mitad de memoria que 44,1 kHz. */
const SAMPLE_RATE = 22_050
/** Segundos analizados, del centro de la canción. */
const WINDOW_SEC = 30
/** Los archivos enormes (FLAC de una hora…) no se decodifican: en móvil no cabrían. */
const MAX_BYTES = 80 * 1024 * 1024

type OfflineCtor = typeof OfflineAudioContext
const offlineCtor = (): OfflineCtor | undefined =>
  typeof window === 'undefined' ? undefined : (window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: OfflineCtor }).webkitOfflineAudioContext)

/** ¿Puede este navegador analizar audio? Si no, todo sigue como antes (atributos con IA). */
export const canAnalyzeAudio = () => typeof Worker !== 'undefined' && typeof WebAssembly === 'object' && !!offlineCtor()

/** Decodifica el archivo a 22 kHz y se queda con 30 s mono del centro. */
export async function decodeWindow(file: File): Promise<Float32Array> {
  if (file.size > MAX_BYTES) throw new Error('Archivo demasiado grande para analizarlo aquí')
  const Ctor = offlineCtor()
  if (!Ctor) throw new Error('Sin Web Audio')
  const ctx = new Ctor(1, 1, SAMPLE_RATE)
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
  const length = Math.min(buffer.length, WINDOW_SEC * SAMPLE_RATE)
  if (length < 3 * SAMPLE_RATE) throw new Error('Demasiado corto para medirlo')
  const start = Math.max(0, Math.floor((buffer.length - length) / 2))
  const mono = new Float32Array(length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) mono[i] += data[start + i] / buffer.numberOfChannels
  }
  return mono
}

/** Tope por archivo (la primera vez incluye descargar Essentia.js, ~2,5 MB). */
const TIMEOUT_MS = 60_000

/** Un solo worker, creado al usarse y cerrado al terminar (libera la memoria del WASM). */
export function createAnalyzer() {
  const worker = new Worker(new URL('./audio-analysis.worker.ts', import.meta.url))
  let next = 0
  let dead: Error | null = null
  const waiting = new Map<number, { resolve: (r: AudioDescriptors) => void; reject: (e: Error) => void }>()
  worker.onmessage = ({ data }: MessageEvent<AnalyzeResponse>) => {
    const w = waiting.get(data.id)
    waiting.delete(data.id)
    if (data.ok) w?.resolve(data.result)
    else w?.reject(new Error(data.error))
  }
  // Un error del propio worker (no cargó) deja de aceptar trabajo: nada se queda esperando.
  worker.onerror = (ev) => {
    dead = new Error(ev.message || 'El análisis se ha detenido')
    for (const w of waiting.values()) w.reject(dead)
    waiting.clear()
  }
  return {
    analyze(samples: Float32Array): Promise<AudioDescriptors> {
      if (dead) return Promise.reject(dead)
      const id = ++next
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(id)
          reject(new Error('El análisis ha tardado demasiado'))
        }, TIMEOUT_MS)
        const done = <T,>(fn: (x: T) => void) => (x: T) => (clearTimeout(timer), fn(x))
        waiting.set(id, { resolve: done(resolve), reject: done(reject) })
        const message: AnalyzeRequest = { id, samples, sampleRate: SAMPLE_RATE }
        worker.postMessage(message, [samples.buffer])
      })
    },
    close: () => worker.terminate(),
  }
}

export type Analyzer = ReturnType<typeof createAnalyzer>
