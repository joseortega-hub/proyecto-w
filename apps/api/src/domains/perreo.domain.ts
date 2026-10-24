import type { DomainDefinition } from './domain.types.js';
import { youtubeDomain } from './youtube.domain.js';

const { config: base } = youtubeDomain;

/** Estilos con los que se describe a cada artista del Modo Perreo (vocabulario cerrado). */
export const PERREO_STYLES = ['perreo', 'romántico', 'trap', 'dembow', 'old school'] as const;
export type PerreoStyle = (typeof PERREO_STYLES)[number];

/**
 * "Modo Perreo": temática secreta de homenaje a 66 artistas del género urbano. Comparte
 * atributos, estilos y sondas con "Mi YouTube", pero el catálogo es común (canciones de los
 * canales de los artistas) y la web solo la muestra tras desbloquearla (`hidden`).
 */
export const perreoDomain: DomainDefinition = {
  id: 'perreo',
  name: 'Modo Perreo',
  itemNoun: 'canción',
  itemNounPlural: 'canciones',
  config: {
    ...base,
    voice:
      'Recomiendas canciones de reguetón y música urbana de un homenaje a artistas del género. Hablas de tú, en español de España, con frases cortas, cercanas y con flow urbano, con respeto.',
    personal: false,
    hidden: true,
    source: {
      name: 'YouTube',
      url: 'https://music.youtube.com',
      attribution:
        'Canciones de los canales de YouTube de cada artista, reproducidas con el reproductor oficial. Fichas con datos de UrbanoPedia, Wikipedia (CC BY-SA), Wikidata y Last.fm.',
    },
  },
};
