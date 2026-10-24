import type { DomainDefinition } from './domain.types.js';
import { youtubeDomain } from './youtube.domain.js';

const { config: base } = youtubeDomain;

/**
 * "Mi carpeta": catálogo personal con las canciones que la persona tiene en su dispositivo.
 * Los audios nunca llegan al servidor: solo artista, título y lo deducido por la IA.
 * Reutiliza los atributos, estilos y sondas de "Mi YouTube"; cambia la fuente y que el
 * audio suena desde el propio dispositivo (el reproductor lo resuelve en el navegador).
 */
export const folderDomain: DomainDefinition = {
  id: 'folder',
  name: 'Mi carpeta',
  itemNoun: 'canción',
  itemNounPlural: 'canciones',
  config: {
    ...base,
    voice:
      'Recomiendas canciones de la propia carpeta de música de la persona, la que tiene en su dispositivo. Hablas de tú, en español de España, con frases cortas, cercanas y con un toque urbano.',
    source: {
      name: 'carpeta',
      url: 'https://developer.mozilla.org/docs/Web/API/File_System_Access_API',
      attribution: 'Tu música, leída en tu navegador: los archivos no salen de tu dispositivo. Nombres confirmados con MusicBrainz.',
    },
  },
};
