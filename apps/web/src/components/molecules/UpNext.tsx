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
  /** Lo que sonó antes (reproductor completo): una fila encima, tocable para volver a ella. */
  previous?: UpNextEntry | null
  /** Si están en orden aleatorio (lo dice la cabecera). */
  shuffle?: boolean
  /** Verbo del botón para lectores de pantalla («Reproducir», «Ver la ficha de»…). */
  actionLabel?: string
  className?: string
}

function Row({ entry, onSelect, actionLabel, dim }: { entry: UpNextEntry; onSelect: (index: number) => void; actionLabel: string; dim?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry.index)}
      aria-label={`${actionLabel} ${entry.title}`}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
        dim && 'opacity-70 hover:opacity-100',
      )}
    >
      <Cover src={entry.imageUrl} alt="" className="size-11 flex-none rounded-[6px]" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] font-bold">{entry.title}</span>
        {entry.subtitle && <span className="truncate text-[13px] text-muted-foreground">{entry.subtitle}</span>}
      </span>
    </button>
  )
}

/** «A continuación»: los próximos elementos de la lista (y, si se pasa, el anterior), tocables para saltar a ellos. */
export function UpNext({ entries, onSelect, previous, shuffle, actionLabel = 'Reproducir', className }: UpNextProps) {
  if (!entries.length && !previous) return null
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {previous && (
        <section aria-labelledby="up-previous" className="flex flex-col gap-1">
          <h2 id="up-previous" className="label-caps px-1 pb-1">
            Sonó antes
          </h2>
          <Row entry={previous} onSelect={onSelect} actionLabel={`Volver a ${actionLabel.toLowerCase()}`} dim />
        </section>
      )}
      {entries.length > 0 && (
        <section aria-labelledby="up-next" className="flex flex-col gap-1">
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
                <Row entry={e} onSelect={onSelect} actionLabel={actionLabel} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
