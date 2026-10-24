import type { VibeAttribute } from './vibe-words'

/** Atributos y vibras de ejemplo para Storybook (los de verdad vienen de la API). */
export const ATTRIBUTES: Record<string, VibeAttribute[]> = {
  music: [
    { key: 'energy', label: 'Energía', lowLabel: 'tranquila', highLabel: 'enérgica' },
    { key: 'positivity', label: 'Positividad', lowLabel: 'melancólica', highLabel: 'alegre' },
    { key: 'focus', label: 'Concentración', lowLabel: 'para escuchar', highLabel: 'para concentrarse' },
    { key: 'acoustic', label: 'Acústico', lowLabel: 'electrónica', highLabel: 'acústica' },
    { key: 'vocal', label: 'Voz', lowLabel: 'instrumental', highLabel: 'con voz' },
    { key: 'dance', label: 'Ritmo', lowLabel: 'para escuchar quieto', highLabel: 'bailable' },
  ],
  games: [
    { key: 'intensity', label: 'Intensidad', lowLabel: 'tranquilo', highLabel: 'frenético' },
    { key: 'challenge', label: 'Reto', lowLabel: 'relajado', highLabel: 'exigente' },
    { key: 'story', label: 'Historia', lowLabel: 'sin historia', highLabel: 'narrativo' },
    { key: 'social', label: 'Compañía', lowLabel: 'en solitario', highLabel: 'en compañía' },
    { key: 'length', label: 'Duración', lowLabel: 'de partidas cortas', highLabel: 'largo' },
    { key: 'lightness', label: 'Tono', lowLabel: 'oscuro', highLabel: 'desenfadado' },
  ],
  movies: [
    { key: 'pace', label: 'Ritmo', lowLabel: 'pausada', highLabel: 'trepidante' },
    { key: 'mood', label: 'Ánimo', lowLabel: 'oscura', highLabel: 'luminosa' },
    { key: 'humor', label: 'Humor', lowLabel: 'seria', highLabel: 'divertida' },
    { key: 'depth', label: 'Profundidad', lowLabel: 'para desconectar', highLabel: 'para pensar' },
    { key: 'romance', label: 'Romance', lowLabel: 'sin romance', highLabel: 'romántica' },
    { key: 'family', label: 'Público', lowLabel: 'para adultos', highLabel: 'para todos' },
    { key: 'era', label: 'Época', lowLabel: 'clásica', highLabel: 'reciente' },
  ],
  books: [
    { key: 'lightness', label: 'Ligereza', lowLabel: 'densa', highLabel: 'ligera' },
    { key: 'pace', label: 'Ritmo', lowLabel: 'pausada', highLabel: 'trepidante' },
    { key: 'mood', label: 'Ánimo', lowLabel: 'oscura', highLabel: 'luminosa' },
    { key: 'fiction', label: 'Ficción', lowLabel: 'de no ficción', highLabel: 'de ficción' },
    { key: 'length', label: 'Extensión', lowLabel: 'corta', highLabel: 'larga' },
    { key: 'era', label: 'Época', lowLabel: 'clásica', highLabel: 'actual' },
  ],
}

export const SCALES = {
  musicAfter: { energy: 0.15, positivity: 0.5, focus: 0.7, acoustic: 0.8, vocal: 0.3, dance: 0.1 },
  musicParty: { energy: 0.92, positivity: 0.9, focus: 0.2, acoustic: 0.15, vocal: 0.8, dance: 0.95 },
  musicBlue: { energy: 0.2, positivity: 0.1, focus: 0.5, acoustic: 0.7, vocal: 0.6, dance: 0.2 },
  games: { intensity: 0.85, challenge: 0.8, story: 0.4, social: 0.1, length: 0.5, lightness: 0.25 },
  movies: { pace: 0.7, mood: 0.2, humor: 0.1, depth: 0.7, romance: 0.1, family: 0.1, era: 0.6 },
  books: { lightness: 0.7, pace: 0.2, mood: 0.8, fiction: 0.9, length: 0.5, era: 0.3 },
}

export const SOURCES: Record<string, string> = {
  energy: 'text',
  positivity: 'answer',
  focus: 'answer',
  acoustic: 'taste',
  vocal: 'context',
  dance: 'guess',
}
