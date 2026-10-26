import { useState } from 'react'
import { Button, Cover, Skeleton, Text } from '@/components/atoms'
import type { YouTubePlaylistInfo } from '@/lib/api'
import { cn } from '@/lib/utils'

interface PlaylistPickerProps {
  /** Las más recientes primero (así llegan de la API). `undefined` mientras cargan. */
  playlists?: YouTubePlaylistInfo[]
  busy?: boolean
  onImport: (ids: string[]) => void
  onCancel: () => void
  className?: string
}

const date = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/** Elegir qué listas de YouTube importar o volver a importar. Las nuevas salen marcadas. */
export function PlaylistPicker({ playlists, busy, onImport, onCancel, className }: PlaylistPickerProps) {
  const [picked, setPicked] = useState<Set<string> | null>(null)
  // Por defecto, las que aún no se han importado.
  const selected = picked ?? new Set((playlists ?? []).filter((p) => !p.importedAt && p.itemCount > 0).map((p) => p.id))
  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  return (
    <section aria-labelledby="playlist-picker" className={cn('flex flex-col gap-3 rounded-[14px] border-[1.5px] border-border bg-card p-4', className)}>
      <header className="flex flex-col gap-0.5">
        <h2 id="playlist-picker" className="label-caps">
          Elige tus listas
        </h2>
        <Text size="sm" tone="muted">
          Las más recientes, primero. Puedes volver a importar una lista para traer lo que hayas añadido.
        </Text>
      </header>
      {!playlists ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : playlists.length === 0 ? (
        <Text size="sm" tone="muted">
          No encontramos listas en tu cuenta de YouTube.
        </Text>
      ) : (
        <ul className="flex max-h-80 flex-col overflow-y-auto">
          {playlists.map((p) => (
            <li key={p.id}>
              <label className={cn('flex min-h-14 cursor-pointer items-center gap-3 rounded-md px-1 py-1.5 hover:bg-secondary', !p.itemCount && 'cursor-default opacity-50')}>
                <input type="checkbox" className="size-5 flex-none accent-[var(--domain)]" checked={selected.has(p.id)} disabled={!p.itemCount || busy} onChange={() => toggle(p.id)} />
                <Cover src={p.thumbnail} alt="" className="size-11 flex-none rounded-[6px]" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-bold">{p.title}</span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {p.itemCount} {p.itemCount === 1 ? 'vídeo' : 'vídeos'}
                    {p.importedAt ? ` · importada el ${date(p.importedAt)}` : ' · sin importar'}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="md" disabled={busy || selected.size === 0} onClick={() => onImport([...selected])}>
          {selected.size > 0 ? `Importar ${selected.size} ${selected.size === 1 ? 'lista' : 'listas'}` : 'Importar'}
        </Button>
        <Button size="md" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </section>
  )
}
