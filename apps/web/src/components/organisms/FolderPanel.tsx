import { Button, Icon, Meter, Skeleton, Spinner, Text } from '@/components/atoms'
import { FolderConnectCard } from '@/components/molecules'
import type { FolderState } from '@/lib/folder'

interface FolderPanelProps {
  state: FolderState
  itemCount?: number
  review?: number
  /** Atributos o embeddings que faltan por terminar en el servidor. */
  pending?: number
  /** Canciones con el sonido sin medir en el dispositivo. */
  unmeasured?: number
  canRemember: boolean
  songsMode?: boolean
  onChoose: () => void
  onReconnect: () => void
  onImport: () => void
  onReview: () => void
  onForget: () => void
  onAnalyzeAudio?: () => void
  onStopAudio?: () => void
}

/** "Mi carpeta" en Inicio: elegir la carpeta, progreso de la identificación y avisos. */
export function FolderPanel({
  state,
  itemCount,
  review,
  pending = 0,
  unmeasured = 0,
  canRemember,
  songsMode,
  onChoose,
  onReconnect,
  onImport,
  onReview,
  onForget,
  onAnalyzeAudio,
  onStopAudio,
}: FolderPanelProps) {
  if (state.access === 'unknown') return <Skeleton className="h-28 w-full rounded-[14px]" />
  const working = state.phase === 'importing' || state.phase === 'finishing'
  const { audio } = state
  const measuring = audio.phase === 'running'
  return (
    <div className="flex flex-col gap-3">
      <FolderConnectCard
        access={state.access}
        folderName={state.folderName}
        found={state.found}
        itemCount={itemCount}
        review={review}
        canRemember={canRemember}
        songsMode={songsMode}
        busy={working}
        onChoose={onChoose}
        onReconnect={onReconnect}
        onImport={onImport}
        onReview={onReview}
        onForget={onForget}
      />
      {working && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <div className="flex items-center gap-2">
            <Spinner className="size-4 text-domain" />
            <Text size="sm" className="truncate font-bold">
              {state.step}
            </Text>
          </div>
          <Meter
            value={state.total ? Math.min(0.98, state.done / state.total) : 0}
            label="Progreso de la identificación"
            className="[&>[data-slot=progress-indicator]]:bg-domain"
          />
        </div>
      )}
      {state.phase === 'error' && (
        <Text size="sm" role="alert">
          No he podido terminar: {state.error}. Vuelve a pulsar y sigo por donde lo dejé.
        </Text>
      )}
      {measuring && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <div className="flex items-center gap-2">
            <Spinner className="size-4 text-domain" />
            <Text size="sm" className="min-w-0 flex-1 truncate font-bold">
              Escuchando tus canciones en este dispositivo ({audio.done}/{audio.total || '…'})
            </Text>
            {onStopAudio && (
              <Button variant="ghost" size="md" onClick={onStopAudio}>
                Pausar
              </Button>
            )}
          </div>
          <Meter
            value={audio.total ? Math.min(0.98, audio.done / audio.total) : 0}
            label="Progreso del análisis del sonido"
            className="[&>[data-slot=progress-indicator]]:bg-domain"
          />
          <Text size="sm" tone="muted">
            Medimos el tempo, la tonalidad, la energía y lo bailable de cada canción. El audio no sale de tu dispositivo.
          </Text>
        </div>
      )}
      {!working && !measuring && state.access === 'ready' && unmeasured > 0 && audio.phase !== 'unsupported' && onAnalyzeAudio && (
        <div className="flex flex-col gap-1.5">
          <Button variant="secondary" onClick={onAnalyzeAudio}>
            <Icon name="activity" />
            Medir el sonido de {unmeasured} {unmeasured === 1 ? 'canción' : 'canciones'}
          </Button>
          <Text size="sm" tone="muted">
            {audio.phase === 'error'
              ? 'No he podido cargar el analizador de sonido. Vuelve a intentarlo con conexión.'
              : 'Tempo, tonalidad, energía y bailabilidad medidos en tu dispositivo, sin subir el audio.'}
          </Text>
        </div>
      )}
      {audio.phase === 'done' && audio.failed > 0 && (
        <Text size="sm" tone="muted">
          {audio.failed} {audio.failed === 1 ? 'archivo no se ha podido' : 'archivos no se han podido'} analizar en este navegador; para esos usamos la estimación con IA.
        </Text>
      )}
      {!working && pending > 0 && (
        <Text size="sm" tone="muted">
          Faltan {pending} canciones por preparar para la búsqueda semántica (cupo diario gratuito de la IA). Ya puedes hacer entrevistas; pulsa el botón más tarde y las termino.
        </Text>
      )}
    </div>
  )
}
