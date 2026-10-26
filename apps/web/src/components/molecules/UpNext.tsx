import { Cover, Text } from '@/components/atoms'
import { cn } from '@/lib/utils'

export interface UpNextEntry {
  /** Posición en la lista (lo que recibe `onSelect`). */
  index: number
  title: string
  subtitle?: string | null
  imageUrl?: string | null
}

interface UpNextProps {
  entries: UpNextEntry[]
  onSelect: (index: number) => void
  /** Si están en orden aleatorio (lo dice la cabecera). */
  shuffle?: boolean
  /** Verbo del botón para lectores de pantalla («Reproducir», «Ver la ficha de»…). */
  actionLabel?: string
  className?: string
}

/** «A continuación»: los próximos elementos de la lista, tocables para saltar a ellos. */
export function UpNext({ entries, onSelect, shuffle, actionLabel = 'Reproducir', className }: UpNextProps) {
  if (!entries.length) return null
  return (
    <section aria-labelledby="up-next" className={cn('flex flex-col gap-1', className)}>
      <header className="flex items-baseline justify-between gap-2 px-1 pb-1">
        <h2 id="up-next" className="label-caps">
          A continuación
        </h2>
        {shuffle && (
          <Text as="span" size="xs" tone="muted">
            En orden aleatorio
          </Text>
        )}
      </header>
      <ol className="flex flex-col">
        {entries.map((e) => (
          <li key={e.index}>
            <button
              type="button"
              onClick={() => onSelect(e.index)}
              aria-label={`${actionLabel} ${e.title}`}
              className="flex min-h-14 w-full items-center gap-3 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none"
            >
              <Cover src={e.imageUrl} alt="" className="size-11 flex-none rounded-[6px]" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px] font-bold">{e.title}</span>
                {e.subtitle && <span className="truncate text-[13px] text-muted-foreground">{e.subtitle}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
