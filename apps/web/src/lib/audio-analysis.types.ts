// Mensajes entre la página y el worker de análisis del audio (Essentia.js).

export interface AnalyzeRequest {
  id: number
  samples: Float32Array
  sampleRate: number
}

export interface AudioDescriptors {
  bpm: number
  tonic: string
  scale: 'major' | 'minor'
  keyStrength: number
  danceability: number
  loudnessDb: number
  dynamicComplexity: number
  seconds: number
}

export type AnalyzeResponse = { id: number; ok: true; result: AudioDescriptors } | { id: number; ok: false; error: string }
