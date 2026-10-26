import { Button, Icon, Skeleton, Text } from '@/components/atoms'
import { ImportProgress, PlaylistPicker, YouTubeConnectCard } from '@/components/molecules'
import type { YouTubePlaylistInfo, YouTubeStatus } from '@/lib/api'

interface YouTubePanelProps {
  status?: YouTubeStatus
  busy?: boolean
  onConnect: () => void
  onImport: () => void
  onDisconnect: () => void
  /** Selector de listas: abierto o no, sus listas (las más recientes primero) e importar las elegidas. */
  picking?: boolean
  playlists?: YouTubePlaylistInfo[]
  onPicking?: (open: boolean) => void
  onImportPlaylists?: (ids: string[]) => void
}

/** "Mi YouTube" en Inicio: conexión con Google, progreso de la importación y avisos. */
export function YouTubePanel({ status, busy, onConnect, onImport, onDisconnect, picking, playlists, onPicking, onImportPlaylists }: YouTubePanelProps) {
  if (!status) return <Skeleton className="h-28 w-full rounded-[14px]" />
  const job = status.import
  const running = job?.status === 'running'
  return (
    <div className="flex flex-col gap-3">
      <YouTubeConnectCard
        status={status.status}
        channelTitle={status.channelTitle}
        itemCount={status.itemCount}
        expiresAt={status.expiresAt}
        unavailable={!status.configured}
        busy={busy || running}
        onConnect={onConnect}
        onImport={onImport}
        onDisconnect={onDisconnect}
      />
      {status.status === 'connected' && !running && onPicking && onImportPlaylists && (
        picking ? (
          <PlaylistPicker playlists={playlists} busy={busy} onImport={onImportPlaylists} onCancel={() => onPicking(false)} />
        ) : (
          <Button size="md" variant="ghost" className="self-start" disabled={busy} onClick={() => onPicking(true)}>
            <Icon name="lists" /> Elegir qué listas importar
          </Button>
        )
      )}
      {job && running && <ImportProgress running step={job.step} found={job.found} analyzed={job.analyzed} embedded={job.embedded} />}
      {job?.status === 'error' && (
        <Text size="sm" role="alert">
          La importación no ha terminado: {job.error}
        </Text>
      )}
      {job?.status === 'done' && job.pending > 0 && (
        <Text size="sm" tone="muted">
          Faltan {job.pending} canciones por terminar de preparar para la búsqueda semántica (cupo diario gratuito de la IA). Ya puedes hacer entrevistas; pulsa «Actualizar mi música» más
          tarde y las termino.
        </Text>
      )}
      {job?.status === 'done' && job.found === 0 && (
        <Text size="sm" tone="muted">
          No he encontrado canciones: solo cuentan los vídeos de la categoría Música de tus listas y tus «Me gusta».
        </Text>
      )}
    </div>
  )
}
