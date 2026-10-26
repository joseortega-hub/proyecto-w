/** Progreso de la importación de la biblioteca de YouTube de una persona. */
export interface YouTubeImportState {
  status: 'running' | 'done' | 'error';
  /** Paso actual, en palabras ("Leyendo tus listas", "Analizando canciones 24/180"). */
  step: string;
  /** Canciones encontradas (vídeos de la categoría Música) y cuántas son nuevas. */
  found: number;
  added: number;
  /** Canciones con atributos deducidos por IA y con embedding. */
  analyzed: number;
  embedded: number;
  /** Lo que falta por analizar o vectorizar (cupo agotado, proveedor caído): se reanuda solo. */
  pending: number;
  /** Unidades de cuota de la YouTube Data API gastadas en esta importación. */
  quotaUnits: number;
  /** Si la lista "LM" (Me gusta de YouTube Music) se pudo leer con la API oficial. */
  likedMusicPlaylist?: 'ok' | 'unavailable';
  /** Listas importadas alguna vez (id → nombre, canciones y fecha), para poder elegir cuáles reimportar. */
  playlists?: Record<string, { title: string; songs: number; importedAt: string }>;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

/** Un vídeo de música leído de YouTube, antes de pasar por la IA. */
export interface YouTubeVideo {
  id: string;
  title: string;
  channelTitle: string;
  description: string;
  tags: string[];
  categoryId: string;
  durationSec: number | null;
  thumbnail: string | null;
  /** De dónde viene: "Me gusta" o el nombre de la lista. */
  from: string[];
}

/** Una lista propia de la persona en YouTube. */
export interface YouTubePlaylist {
  id: string;
  title: string;
  itemCount: number;
  /** Fecha de creación (la API no da la de la última modificación). */
  publishedAt: string | null;
  thumbnail: string | null;
}
