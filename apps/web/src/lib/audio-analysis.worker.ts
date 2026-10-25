// Worker clásico: analiza un tramo de audio mono con Essentia.js (WebAssembly).
// Essentia.js se descarga de jsDelivr con versión fija solo al usarse (no va en el bundle
// ni en la caché de la PWA). Es AGPL-3.0: se usa sin modificar y este repo es público.
// El audio llega ya decodificado desde la página y nunca sale del dispositivo.
// Sin `import` ni `export` (es un script): así Vite lo sirve como worker clásico también en desarrollo.

type AnalyzeRequest = import('./audio-analysis.types').AnalyzeRequest
type AnalyzeResponse = import('./audio-analysis.types').AnalyzeResponse
type AudioDescriptors = import('./audio-analysis.types').AudioDescriptors

declare function importScripts(...urls: string[]): void
declare const EssentiaWASM: (opts: { locateFile: (file: string) => string }) => Promise<unknown>
declare const Essentia: new (wasm: unknown) => EssentiaApi

interface Vector {
  delete(): void
}
interface EssentiaApi {
  arrayToVector(a: Float32Array): Vector
  PercivalBpmEstimator(s: Vector, frameSize?: number, frameSizeOSS?: number, hopSize?: number, hopSizeOSS?: number, maxBPM?: number, minBPM?: number, sampleRate?: number): { bpm: number }
  KeyExtractor(s: Vector, averageDetuningCorrection?: boolean, frameSize?: number, hopSize?: number, hpcpSize?: number, maxFrequency?: number, maximumSpectralPeaks?: number, minFrequency?: number, pcpThreshold?: number, profileType?: string, sampleRate?: number): { key: string; scale: string; strength: number }
  Danceability(s: Vector, maxTau?: number, minTau?: number, sampleRate?: number): { danceability: number }
  DynamicComplexity(s: Vector, frameSize?: number, sampleRate?: number): { dynamicComplexity: number; loudness: number }
}

const CDN = 'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/'

let essentia: Promise<EssentiaApi> | null = null
const load = () =>
  (essentia ??= (async () => {
    // La compilación web de Essentia.js 0.1.3 no contempla workers: busca `document.currentScript`
    // para saber de dónde se cargó. Se le da un `document` mínimo solo mientras arranca.
    const g = self as unknown as { document?: unknown }
    g.document = { currentScript: { src: `${CDN}essentia-wasm.web.js` }, title: '' }
    try {
      importScripts(`${CDN}essentia-wasm.web.js`, `${CDN}essentia.js-core.umd.min.js`)
      const wasm = await EssentiaWASM({ locateFile: (file) => CDN + file })
      return new Essentia(wasm)
    } finally {
      delete g.document
    }
  })())

const finite = (x: number, fallback = 0) => (Number.isFinite(x) ? x : fallback)

function analyze(e: EssentiaApi, samples: Float32Array, sr: number): AudioDescriptors {
  const signal = e.arrayToVector(samples)
  try {
    const { bpm } = e.PercivalBpmEstimator(signal, 1024, 2048, 128, 128, 210, 50, sr)
    const key = e.KeyExtractor(signal, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', sr)
    const { danceability } = e.Danceability(signal, 8800, 310, sr)
    const dyn = e.DynamicComplexity(signal, 0.2, sr)
    return {
      bpm: Math.min(260, Math.max(30, finite(bpm, 100))),
      tonic: key.key,
      scale: key.scale === 'major' ? 'major' : 'minor',
      keyStrength: Math.min(1, Math.max(0, finite(key.strength))),
      danceability: Math.min(10, Math.max(0, finite(danceability))),
      loudnessDb: Math.min(5, Math.max(-90, finite(dyn.loudness, -90))),
      dynamicComplexity: Math.min(60, Math.max(0, finite(dyn.dynamicComplexity))),
      seconds: samples.length / sr,
    }
  } finally {
    signal.delete()
  }
}

const scope = self as unknown as { onmessage: ((ev: MessageEvent<AnalyzeRequest>) => void) | null; postMessage(m: AnalyzeResponse): void }

scope.onmessage = async ({ data }) => {
  try {
    const e = await load()
    scope.postMessage({ id: data.id, ok: true, result: analyze(e, data.samples, data.sampleRate) })
  } catch (error) {
    scope.postMessage({ id: data.id, ok: false, error: String((error as Error)?.message ?? error) })
  }
}
