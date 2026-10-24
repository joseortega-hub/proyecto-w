import { Icon } from '@/components/atoms'
import { Explanation, FeedbackButtons, ItemRow } from '@/components/molecules'
import { geekLine } from '@/lib/details'
import type { Feedback, ResultEntry } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ResultListProps {
  entries: ResultEntry[]
  currentId?: string | null
  playing?: boolean
  onSelect: (index: number) => void
  /** Si el toque abre la ficha en vez de reproducir (temáticas sin reproductor). */
  opensDetail?: boolean
  /** 👍/👎 de la persona por elemento; sin `onFeedback` no se muestran. */
  feedback?: Record<string, Feedback>
  onFeedback?: (itemId: string, value: Feedback | null) => void
}

/** La lista personalizada. La primera (o la que suena) se destaca con su explicación abierta. */
export function ResultList({ entries, currentId, playing, onSelect, opensDetail, feedback = {}, onFeedback }: ResultListProps) {
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
              detail={geekLine(e.item.domainId, e.item.details)}
              match={e.match}
              active={e.item.id === currentId}
              playing={playing}
              onSelect={() => onSelect(i)}
              actionLabel={opensDetail ? 'Ver la ficha de' : undefined}
              className={cn('rounded-[14px] px-3 py-2', active && 'border border-border bg-card py-3')}
            >
              {(e.reason || onFeedback || e.likes?.length) && (
                <div className="flex flex-col gap-1.5">
                  {e.likes && e.likes.length > 0 && (
                    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Icon name="heart" className="size-3.5 flex-none fill-current text-domain" />
                      <span className="truncate">Va con tus gustos: {e.likes.join(', ')}</span>
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">{e.reason && <Explanation key={String(active)} reason={e.reason} defaultOpen={active} />}</div>
                    {onFeedback && (
                      <FeedbackButtons title={e.item.title} value={feedback[e.item.id] ?? null} onChange={(v) => onFeedback(e.item.id, v)} />
                    )}
                  </div>
                </div>
              )}
            </ItemRow>
          </li>
        )
      })}
    </ol>
  )
}
