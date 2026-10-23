import { Explanation, ItemRow } from '@/components/molecules'
import type { ResultEntry } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ResultListProps {
  entries: ResultEntry[]
  currentId?: string | null
  playing?: boolean
  onSelect: (index: number) => void
}

/** La lista personalizada. La primera (o la que suena) se destaca con su explicación abierta. */
export function ResultList({ entries, currentId, playing, onSelect }: ResultListProps) {
  const highlighted = currentId ?? entries[0]?.item.id
  return (
    <ol className="flex flex-col gap-1.5">
      {entries.map((e, i) => {
        const active = e.item.id === highlighted
        return (
          <li key={e.item.id}>
            <ItemRow
              title={e.item.title}
              subtitle={e.item.subtitle}
              imageUrl={e.item.imageUrl}
              durationSec={e.item.durationSec}
              match={e.match}
              active={e.item.id === currentId}
              playing={playing}
              onSelect={() => onSelect(i)}
              className={cn('rounded-[14px] px-3 py-2', active && 'border border-border bg-card py-3')}
            >
              {e.reason && <Explanation key={String(active)} reason={e.reason} defaultOpen={active} />}
            </ItemRow>
          </li>
        )
      })}
    </ol>
  )
}
