import type { DomainDefinition } from './domain.types.js';
import { musicDomain } from './music.domain.js';

/**
 * Estilos con los que la IA etiqueta la música importada de YouTube (vocabulario cerrado).
 * A diferencia de Jamendo, aquí manda la música urbana y latina.
 */
export const YOUTUBE_GENRES = [
  'reguetón',
  'reguetón-lento',
  'trap',
  'dembow',
  'pop-urbano',
  'drill',
  'dancehall',
  'afrobeats',
  'bachata',
  'salsa',
  'merengue',
  'cumbia',
  'corridos',
  'pop',
  'pop-latino',
  'balada',
  'k-pop',
  'cantautor',
  'flamenco',
  'rumba',
  'hip-hop',
  'rap',
  'r&b',
  'funk',
  'electrónica',
  'house',
  'techno',
  'dance',
  'lofi',
  'ambient',
  'rock',
  'indie',
  'metal',
  'punk',
  'jazz',
  'clásica',
  'banda-sonora',
] as const;

const { config: music } = musicDomain;

/**
 * "Mi YouTube": catálogo personal con la música que cada persona importa de su cuenta
 * de YouTube (listas propias y "Me gusta"). Mismos atributos que música, pero los
 * elementos son privados: cada persona solo ve y recibe los suyos (`items.owner_id`).
 */
export const youtubeDomain: DomainDefinition = {
  id: 'youtube',
  name: 'Mi YouTube',
  itemNoun: 'canción',
  itemNounPlural: 'canciones',
  config: {
    ...music,
    voice:
      'Recomiendas canciones de la propia biblioteca de YouTube de la persona (sus listas y sus "Me gusta"). Hablas de tú, en español de España, con frases cortas, cercanas y con un toque urbano.',
    personal: true,
    source: {
      name: 'YouTube',
      url: 'https://music.youtube.com',
      attribution: 'Tu música de YouTube, leída con la YouTube Data API y reproducida con el reproductor oficial de YouTube.',
    },
    tagGroups: [
      { key: 'urban', label: 'reguetón y trap', tags: ['reguetón', 'reguetón-lento', 'trap', 'dembow', 'pop-urbano', 'drill', 'dancehall', 'afrobeats'] },
      { key: 'tropical', label: 'bachata, salsa y tropical', tags: ['bachata', 'salsa', 'merengue', 'cumbia', 'corridos'] },
      { key: 'pop', label: 'pop y baladas', tags: ['pop', 'pop-latino', 'balada', 'k-pop', 'cantautor', 'flamenco', 'rumba'] },
      { key: 'hiphop', label: 'hip hop y R&B', tags: ['hip-hop', 'rap', 'r&b', 'funk'] },
      { key: 'electronic', label: 'electrónica', tags: ['electrónica', 'house', 'techno', 'dance', 'lofi', 'ambient'] },
      { key: 'rock', label: 'rock, jazz y otros', tags: ['rock', 'indie', 'metal', 'punk', 'jazz', 'clásica', 'banda-sonora'] },
    ],
    probes: [
      ...music.probes.filter((p) => !p.informs.includes('genres')),
      { id: 'perreo', intent: 'Si le apetece perreo, reguetón o trap', informs: ['genres'], yesChip: 'perreo', noChip: 'sin perreo' },
      { id: 'tropical', intent: 'Si le apetece algo tropical para bailar en pareja, como bachata o salsa', informs: ['genres'], yesChip: 'tropical', noChip: 'sin tropical' },
      { id: 'pop', intent: 'Si le apetece pop o baladas para cantar', informs: ['genres'], yesChip: 'pop', noChip: 'sin pop' },
      { id: 'hiphop', intent: 'Si le apetece hip hop, rap o R&B', informs: ['genres'], yesChip: 'hip hop', noChip: 'sin rap' },
      { id: 'electronic', intent: 'Si le apetece música electrónica', informs: ['genres'], yesChip: 'electrónica', noChip: 'sin electrónica' },
    ],
    preferences: music.preferences,
    // La biblioteca personal es más pequeña que un catálogo público.
    result: { candidates: 32, judged: 16, size: 12 },
  },
};
