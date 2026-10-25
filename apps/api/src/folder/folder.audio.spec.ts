import { describe, expect, it } from 'vitest';
import { audioFacets, audioSchema, danceTempo, keyLabel, measuredAttributes, type AudioMeasurement } from './folder.audio.js';

const base: AudioMeasurement = {
  key: 'musica/tema.mp3|123',
  bpm: 120,
  tonic: 'A',
  scale: 'minor',
  keyStrength: 0.8,
  danceability: 1.4,
  loudnessDb: -9,
  dynamicComplexity: 3,
  seconds: 30,
  version: 1,
};

describe('medición del audio → atributos', () => {
  it('un tema fuerte y bailable a 120 BPM sale con energía y baile altos', () => {
    const { energy, dance } = measuredAttributes(base);
    expect(energy).toBeGreaterThan(0.75);
    expect(dance).toBeGreaterThan(0.75);
  });

  it('una pieza suave, lenta y con mucha dinámica sale tranquila y poco bailable', () => {
    const { energy, dance } = measuredAttributes({ ...base, bpm: 62, loudnessDb: -26, dynamicComplexity: 11, danceability: 0.7 });
    expect(energy).toBeLessThan(0.15);
    expect(dance).toBeLessThan(0.1);
  });

  it('un tema muy bajito no sale enérgico aunque el tempo sea alto', () => {
    expect(measuredAttributes({ ...base, bpm: 140, loudnessDb: -30, dynamicComplexity: 1 }).energy).toBeLessThan(0.2);
  });

  it('siempre entre 0 y 1, también en los extremos', () => {
    for (const m of [
      { ...base, bpm: 30, loudnessDb: -90, dynamicComplexity: 60, danceability: 0 },
      { ...base, bpm: 260, loudnessDb: 5, dynamicComplexity: 0, danceability: 10 },
    ]) {
      for (const v of Object.values(measuredAttributes(m))) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('el dembow detectado a doble tempo se pliega a la mitad', () => {
    expect(danceTempo(190)).toBe(danceTempo(95));
    expect(danceTempo(95)).toBe(1);
    expect(danceTempo(60)).toBe(0);
    expect(audioFacets({ ...base, bpm: 188 }, ['energy']).bpm).toBe('94');
  });
});

describe('tonalidad', () => {
  it('en español', () => {
    expect(keyLabel('A', 'minor')).toBe('La menor');
    expect(keyLabel('Eb', 'major')).toBe('Mi♭ mayor');
    expect(keyLabel('F#', 'minor')).toBe('Fa♯ menor');
  });

  it('con poca seguridad no se enseña', () => {
    expect(audioFacets(base, ['energy', 'dance'])).toEqual({ measured: ['energy', 'dance'], bpm: '120', musicKey: 'La menor', audioV: '1' });
    expect(audioFacets({ ...base, keyStrength: 0.2 }, []).musicKey).toBeUndefined();
  });
});

describe('validación de la medición', () => {
  it('acepta una medición normal', () => {
    expect(audioSchema.safeParse({ measurements: [base] }).success).toBe(true);
  });

  it('rechaza valores imposibles, tonalidades inventadas y lotes vacíos o enormes', () => {
    expect(audioSchema.safeParse({ measurements: [{ ...base, bpm: 900 }] }).success).toBe(false);
    expect(audioSchema.safeParse({ measurements: [{ ...base, tonic: 'H' }] }).success).toBe(false);
    expect(audioSchema.safeParse({ measurements: [{ ...base, scale: 'dorian' }] }).success).toBe(false);
    expect(audioSchema.safeParse({ measurements: [{ ...base, keyStrength: 2 }] }).success).toBe(false);
    expect(audioSchema.safeParse({ measurements: [{ ...base, danceability: 11 }] }).success).toBe(false);
    expect(audioSchema.safeParse({ measurements: [{ ...base, loudnessDb: Number.NaN }] }).success).toBe(false);
    expect(audioSchema.safeParse({ measurements: [{ ...base, key: '' }] }).success).toBe(false);
    expect(audioSchema.safeParse({ measurements: [] }).success).toBe(false);
    expect(audioSchema.safeParse({ measurements: Array.from({ length: 21 }, () => base) }).success).toBe(false);
  });
});
