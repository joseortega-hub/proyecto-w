import { useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { IconButton, SearchField, Skeleton, Text } from '@/components/atoms'
import { ItemRow } from '@/components/molecules'
import { api, type Item } from '@/lib/api'

interface AddTracksPanelProps {
  domainId: string
  noun: string
  /** Los que ya están en la lista: se marcan y no se pueden añadir dos veces. */
  existingIds: Set<string>
  onAdd: (item: Item) => void
}

/** Busca en la biblioteca de la temática y añade al final de la lista. */
export function AddTracksPanel({ domainId, noun, existingIds, onAdd }: AddTracksPanelProps) {
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const found = useQuery({ queryKey: ['add-search', domainId, q], queryFn: () => api.browse(domainId, { q, limit: 8 }), enabled: q.length >= 2 })

  return (
    <section aria-label={`Añadir ${noun}`} className="flex flex-col gap-2 rounded-[14px] border border-border bg-card p-3">
      <SearchField label={`Buscar ${noun} para añadir`} value={query} onChange={(e) => setQuery(e.target.value)} />
      {q.length < 2 ? (
        <Text size="sm" tone="muted">Escribe el título o el artista y lo añado al final.</Text>
      ) : found.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : found.isError ? (
        <Text size="sm" role="alert">No he podido buscar: {found.error.message}</Text>
      ) : found.data.items.length === 0 ? (
        <Text size="sm" tone="muted">No encuentro nada con «{q}».</Text>
      ) : (
        <ul className="flex flex-col gap-1">
          {found.data.items.map((item) => {
            const inList = existingIds.has(item.id)
            return (
              <li key={item.id} className="flex items-center gap-1">
                <ItemRow title={item.title} subtitle={item.subtitle} imageUrl={item.imageUrl} durationSec={item.durationSec} className="min-w-0 flex-1 px-1" />
                <IconButton icon={inList ? 'check' : 'plus'} label={inList ? `${item.title} ya está en la lista` : `Añadir ${item.title}`} disabled={inList} onClick={() => onAdd(item)} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
