import { useNavigate } from 'react-router'
import { Button, Heading, IconButton } from '@/components/atoms'
import { EmptyState, ItemRow } from '@/components/molecules'
import { useDomain } from '@/lib/domain'
import { timeAgo } from '@/lib/format'
import { useSavedLists } from '@/lib/saved-lists'

/** Mis listas: las guardadas en este dispositivo (sin registro en el MVP). */
export function ListsPage() {
  const navigate = useNavigate()
  const domain = useDomain()
  const { lists, remove } = useSavedLists(domain.id)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-5 py-5 md:px-10 md:py-8">
      <Heading>Mis listas</Heading>
      {lists.length === 0 ? (
        <EmptyState
          icon="lists"
          title="Aún no has guardado ninguna lista"
          description="Al terminar una entrevista, pulsa Guardar y la tendrás aquí."
          action={<Button onClick={() => navigate(domain.path('entrevista'))}>Empezar una entrevista</Button>}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {lists.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <ItemRow
                title={l.title}
                subtitle={`${l.count} ${domain.nounPlural} · ${timeAgo(l.savedAt)}`}
                imageUrl={l.cover}
                actionLabel="Abrir la lista"
                onSelect={() => navigate(domain.path(`resultado/${l.id}`))}
                className="flex-1"
              />
              <IconButton icon="close" label={`Quitar ${l.title}`} variant="ghost" onClick={() => remove(l.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
