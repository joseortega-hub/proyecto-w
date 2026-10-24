import { useState } from 'react'
import { Button, Icon, Text } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface FolderTrackRowProps {
  title: string
  artist: string | null
  /** Nombre sin confirmar con MusicBrainz. */
  review?: boolean
  saving?: boolean
  onSave: (value: { title: string; artist: string | null }) => void
  className?: string
}

const field =
  'min-w-0 flex-1 rounded-[10px] border-[1.5px] border-border bg-card px-3 py-2 text-[15px] outline-none focus-visible:border-domain focus-visible:ring-2 focus-visible:ring-domain/30'

/** Una canción de la carpeta con su artista y título editables, para corregir los nombres dudosos. */
export function FolderTrackRow({ title, artist, review, saving, onSave, className }: FolderTrackRowProps) {
  const [t, setT] = useState(title)
  const [a, setA] = useState(artist ?? '')
  const changed = t.trim() !== title || a.trim() !== (artist ?? '')
  return (
    <form
      className={cn('flex flex-col gap-2 rounded-[14px] border border-border bg-card p-3', className)}
      onSubmit={(e) => {
        e.preventDefault()
        if (t.trim()) onSave({ title: t.trim(), artist: a.trim() || null })
      }}
    >
      {review && (
        <Text size="xs" font="label" className="flex items-center gap-1 text-domain">
          <Icon name="sparkles" className="size-3.5" /> Por revisar
        </Text>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={field} value={a} onChange={(e) => setA(e.target.value)} placeholder="Artista" aria-label={`Artista de ${title}`} />
        <input className={field} value={t} onChange={(e) => setT(e.target.value)} placeholder="Título" aria-label="Título" required />
      </div>
      <Button size="md" variant={review || changed ? 'primary' : 'secondary'} type="submit" disabled={saving || (!changed && !review)}>
        <Icon name="check" /> {changed ? 'Guardar cambio' : 'Está bien así'}
      </Button>
    </form>
  )
}
