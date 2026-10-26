/** Acciones que el reproductor registra en la Media Session (notificación y pantalla de bloqueo). */
export const MEDIA_ACTIONS: MediaSessionAction[] = ['play', 'pause', 'nexttrack', 'previoustrack', 'seekto', 'seekbackward', 'seekforward', 'stop']

interface ClosableAudio {
  pause(): void
  removeAttribute(name: string): void
  load?(): void
}

interface ClosableVideo {
  stopVideo(): void
  destroy(): void
}

type ClosableSession = Pick<MediaSession, 'setActionHandler'> & {
  metadata: MediaMetadata | null
  playbackState: MediaSessionPlaybackState
  setPositionState?: (state?: MediaPositionState) => void
}

/**
 * Para la música y suelta todo lo que la sostenía: el `<audio>` sin fuente, el IFrame de YouTube
 * destruido (se crea otro al volver a sonar un vídeo) y la Media Session vacía, para que la
 * notificación del móvil desaparezca y sus botones no reanuden nada.
 */
export function closePlayback({ audio, video, mediaSession }: { audio?: ClosableAudio | null; video?: ClosableVideo | null; mediaSession?: ClosableSession | null }) {
  audio?.pause()
  audio?.removeAttribute('src')
  audio?.load?.()
  if (video) {
    try {
      video.stopVideo()
      video.destroy()
    } catch {
      // El IFrame ya no estaba.
    }
  }
  if (!mediaSession) return
  mediaSession.metadata = null
  mediaSession.playbackState = 'none'
  for (const action of MEDIA_ACTIONS) {
    try {
      mediaSession.setActionHandler(action, null)
    } catch {
      // Acción no admitida en este navegador.
    }
  }
  try {
    mediaSession.setPositionState?.()
  } catch {
    // Sin posición que borrar.
  }
}
