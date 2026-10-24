import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Heading, Skeleton, Text } from '@/components/atoms'
import { EmptyState, FolderTrackRow } from '@/components/molecules'
import { useCorrectTrack, useFolderTracks } from '@/lib/folder'

/** "Mi carpeta" → Revisar: corregir a mano los nombres que MusicBrainz no ha confirmado. */
export function FolderReviewPage() {
  const tracks = useFolderTracks()
  const correct = useCorrectTrack()
  const [all, setAll] = useState(false)
  const shown = (tracks.data ?? []).filter((t) => all || t.review)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-5 md:px-10 md:py-8">
      <Heading>Revisar nombres</Heading>
      <Text tone="muted">
        La IA propone y MusicBrainz confirma. Lo que no ha podido confirmar sale aquí: corrígelo y vuelvo a analizar la canción.
      </Text>
      {tracks.isPending ? (
        <Skeleton className="h-32 w-full rounded-[14px]" />
      ) : tracks.isError ? (
        <EmptyState icon="retry" title="No puedo cargar tus canciones" description={tracks.error.message} />
      ) : shown.length === 0 ? (
        <EmptyState icon="check" title="Todo confirmado" description="No queda ningún nombre por revisar." />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((t) => (
            // La clave incluye el nombre guardado para que el formulario se reinicie tras corregir.
            <li key={`${t.id}:${t.title}:${t.artist}:${t.review}`}>
              <FolderTrackRow
                title={t.title}
                artist={t.artist}
                review={t.review}
                saving={correct.isPending}
                onSave={(value) =>
                  correct.mutate({ id: t.id, ...value }, { onSuccess: () => toast.success('Guardado'), onError: (e) => toast.error('No he podido guardarlo', { description: e.message }) })
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" onClick={() => setAll((v) => !v)}>
        {all ? 'Ver solo las dudosas' : 'Ver todas mis canciones'}
      </Button>
    </div>
  )
}
