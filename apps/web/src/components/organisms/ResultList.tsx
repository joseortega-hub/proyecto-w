import { useRef, useState } from 'react'
import { DragHandle, Icon, IconButton } from '@/components/atoms'
import { Explanation, FeedbackButtons, ItemRow, SeenControl } from '@/components/molecules'
import { geekLine } from '@/lib/details'
import type { Feedback, Item, ResultEntry, SeenRating } from '@/lib/api'
import type { SeenWords } from '@/lib/seen'
import { useDragReorder } from '@/lib/drag-reorder'
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
  /** «Ya la vi»: valoración por elemento ya visto; sin `onSeen` no se muestra. */
  seen?: ReadonlyMap<string, SeenRating | null>
  seenWords?: SeenWords
  onSeen?: (item: Item, next: { seen: boolean; rating: SeenRating | null }) => void
  /** Modo edición: asa para reordenar y botón para quitar. */
  edit?: { onMove: (from: number, to: number) => void; onRemove: (index: number) => void }
}

/** La lista personalizada. La primera (o la que suena) se destaca con su explicación abierta. */
export function ResultList({ entries, currentId, playing, onSelect, opensDetail, feedback = {}, onFeedback, seen, seenWords, onSeen, edit }: ResultListProps) {
  const listRef = useRef<HTMLOListElement>(null)
  const [announce, setAnnounce] = useState('')
  const { dragging, handleProps, listProps } = useDragReorder({
    listRef,
    onMove: (from, to) => {
      edit?.onMove(from, to)
      setAnnounce(`${entries[from]?.item.title} pasa a la posición ${to + 1} de ${entries.length}`)
    },
  })
  const highlighted = currentId ?? entries[0]?.item.id
  return (
    <>
    {edit && <p role="status" className="sr-only">{announce}</p>}
    <ol ref={listRef} className={cn('flex flex-col gap-1.5', dragging !== null && 'select-none')} {...(edit ? listProps : {})}>
      {entries.map((e, i) => {
        const active = e.item.id === highlighted
        return (
          <li
            key={e.item.id}
            className={cn(edit && 'flex items-start gap-1 rounded-[14px] transition-shadow', dragging === i && 'relative z-10 scale-[1.02] bg-card shadow-lg ring-2 ring-ring')}
          >
            {edit && <DragHandle {...handleProps(i, e.item.id, entries.length)} active={dragging === i} label={`Mover ${e.item.title} (posición ${i + 1} de ${entries.length})`} className="mt-1.5" />}
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
              className={cn('min-w-0 flex-1 rounded-[14px] px-3 py-2', active && 'border border-border bg-card py-3')}
            >
              {(e.reason || onFeedback || onSeen || e.likes?.length) && (
                <div className="flex flex-col gap-1.5">
                  {e.likes && e.likes.length > 0 && (
                    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <Icon name="heart" className="size-3.5 flex-none fill-current text-domain" />
                      <span className="truncate">Va con tus gustos: {e.likes.join(', ')}</span>
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">{e.reason && <Explanation key={String(active)} reason={e.reason} defaultOpen={active} />}</div>
                    <div className="flex flex-none items-center">
                      {onSeen && seenWords && !seen?.has(e.item.id) && (
                        <SeenControl compact title={e.item.title} words={seenWords} rating={undefined} onChange={(n) => onSeen(e.item, n)} />
                      )}
                      {onFeedback && (
                        <FeedbackButtons title={e.item.title} value={feedback[e.item.id] ?? null} onChange={(v) => onFeedback(e.item.id, v)} />
                      )}
                    </div>
                  </div>
                  {onSeen && seenWords && seen?.has(e.item.id) && (
                    <SeenControl title={e.item.title} words={seenWords} rating={seen.get(e.item.id)} onChange={(n) => onSeen(e.item, n)} />
                  )}
                </div>
              )}
            </ItemRow>
            {edit && <IconButton icon="trash" variant="ghost" label={`Quitar ${e.item.title}`} className="mt-1.5" onClick={() => edit.onRemove(i)} />}
          </li>
        )
      })}
    </ol>
    </>
  )
}
