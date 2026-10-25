import { z } from 'zod';

/**
 * Medición real del audio de "Mi carpeta", hecha en el navegador con Essentia.js
 * (descriptores clásicos sobre ~30 s del centro de la canción). El audio nunca llega:
 * solo estos números. Aquí se validan y se convierten a los atributos 0–1 del dominio.
 * Los atributos medidos ganan a los deducidos por la IA (`facets.measured`).
 */

/** Sube si cambia el análisis del navegador: lo medido con otra versión se puede repetir. */
export const AUDIO_VERSION = 1;

/** Facetas que guarda la medición; se conservan al reimportar o corregir el nombre. */
export const AUDIO_FACETS = ['measured', 'bpm', 'musicKey', 'audioV'] as const;

const TONICS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'] as const;

const measurement = z.object({
  key: z.string().trim().min(1).max(300),
  /** Tempo (PercivalBpmEstimator). */
  bpm: z.number().min(30).max(260),
  /** Tonalidad (KeyExtractor, perfil `bgate`). */
  tonic: z.enum(TONICS),
  scale: z.enum(['major', 'minor']),
  keyStrength: z.number().min(0).max(1),
  /** Danceability de Essentia (DFA): ~0–3, la música pop suele quedar entre 1 y 1,8 (un pulso sintético pasa de 5). */
  danceability: z.number().min(0).max(10),
  /** Sonoridad media en dB (DynamicComplexity): de −60 (silencio) a 0. */
  loudnessDb: z.number().min(-90).max(5),
  /** Variación de sonoridad en dB (DynamicComplexity). */
  dynamicComplexity: z.number().min(0).max(60),
  /** Segundos analizados. */
  seconds: z.number().min(3).max(120),
  version: z.number().int().min(1).max(100),
});

export const audioSchema = z.object({ measurements: z.array(measurement).min(1).max(20) });
export type AudioMeasurement = z.infer<typeof measurement>;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 en `lo`, 1 en `hi`, lineal entre medias. */
const ramp = (x: number, lo: number, hi: number) => clamp01((x - lo) / (hi - lo));
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Tempo "bailable": pleno entre 88 y 130 BPM (reguetón, pop, house), cae hacia 60 y 175.
 * Los tempos a doble velocidad (dembow detectado a 180) se pliegan antes a la mitad.
 */
export function danceTempo(bpm: number): number {
  const b = bpm > 175 ? bpm / 2 : bpm;
  if (b < 88) return ramp(b, 60, 88);
  if (b > 130) return 1 - ramp(b, 130, 175);
  return 1;
}

/**
 * Atributos medidos. Solo los que el audio dice de verdad: energía (sonoridad, tempo y
 * poca variación dinámica) y bailabilidad (DFA de Essentia + tempo). Ánimo, voz y
 * acústica siguen saliendo de la IA: con descriptores clásicos serían una corazonada.
 */
export function measuredAttributes(m: AudioMeasurement): { energy: number; dance: number } {
  const loud = ramp(m.loudnessDb, -24, -7);
  const tempo = ramp(m.bpm > 175 ? m.bpm / 2 : m.bpm, 65, 145);
  const steady = 1 - ramp(m.dynamicComplexity, 3, 10);
  // Un tema muy bajito no es enérgico aunque el tempo salga alto (sin pulso, el tempo es poco fiable).
  const energy = 0.6 * loud + (0.25 * tempo + 0.15 * steady) * (0.4 + 0.6 * loud);
  const dance = 0.7 * ramp(m.danceability, 0.8, 1.7) + 0.3 * danceTempo(m.bpm);
  return { energy: round2(energy), dance: round2(dance) };
}

const SOLFEGE: Record<string, string> = {
  C: 'Do',
  'C#': 'Do♯',
  Db: 'Re♭',
  D: 'Re',
  'D#': 'Re♯',
  Eb: 'Mi♭',
  E: 'Mi',
  F: 'Fa',
  'F#': 'Fa♯',
  Gb: 'Sol♭',
  G: 'Sol',
  'G#': 'Sol♯',
  Ab: 'La♭',
  A: 'La',
  'A#': 'La♯',
  Bb: 'Si♭',
  B: 'Si',
};

/** "A" + "minor" → "La menor". */
export const keyLabel = (tonic: string, scale: 'major' | 'minor') => `${SOLFEGE[tonic] ?? tonic} ${scale === 'major' ? 'mayor' : 'menor'}`;

/** Facetas que se guardan con la medición (las ve la ficha: "120 BPM · La menor"). */
export function audioFacets(m: AudioMeasurement, measured: string[]): Record<string, string | string[]> {
  return {
    measured,
    bpm: String(Math.round(m.bpm > 175 ? m.bpm / 2 : m.bpm)),
    // Con poca seguridad, la tonalidad no se enseña.
    ...(m.keyStrength >= 0.35 ? { musicKey: keyLabel(m.tonic, m.scale) } : {}),
    audioV: String(m.version),
  };
}
