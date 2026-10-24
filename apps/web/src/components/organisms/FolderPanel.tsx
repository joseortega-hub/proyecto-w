import { Meter, Skeleton, Spinner, Text } from '@/components/atoms'
import { FolderConnectCard } from '@/components/molecules'
import type { FolderState } from '@/lib/folder'

interface FolderPanelProps {
  state: FolderState
  itemCount?: number
  review?: number
  /** Atributos o embeddings que faltan por terminar en el servidor. */
  pending?: number
  canRemember: boolean
  onChoose: () => void
  onReconnect: () => void
  onImport: () => void
  onReview: () => void
  onForget: () => void
}

/** "Mi carpeta" en Inicio: elegir la carpeta, progreso de la identificación y avisos. */
export function FolderPanel({ state, itemCount, review, pending = 0, canRemember, onChoose, onReconnect, onImport, onReview, onForget }: FolderPanelProps) {
  if (state.access === 'unknown') return <Skeleton className="h-28 w-full rounded-[14px]" />
  const working = state.phase === 'importing' || state.phase === 'finishing'
  return (
    <div className="flex flex-col gap-3">
      <FolderConnectCard
        access={state.access}
        folderName={state.folderName}
        found={state.found}
        itemCount={itemCount}
        review={review}
        canRemember={canRemember}
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
      {!working && pending > 0 && (
        <Text size="sm" tone="muted">
          Faltan {pending} canciones por preparar para la búsqueda semántica (cupo diario gratuito de la IA). Ya puedes hacer entrevistas; pulsa el botón más tarde y las termino.
        </Text>
      )}
    </div>
  )
}
