import { Button, Chip, Text } from '@/components/atoms'
import type { PerreoReviewItem } from '@/lib/perreo-types'
import { cn } from '@/lib/utils'

interface ReviewCandidateProps {
  item: PerreoReviewItem
  onDecide: (decision: 'accept' | 'reject') => void
  busy?: boolean
  className?: string
}

/** Una cuenta dudosa de Instagram: qué se encontró, por qué hay dudas y dos botones. */
export function ReviewCandidate({ item, onDecide, busy, className }: ReviewCandidateProps) {
  const listeners = item.listeners ? new Intl.NumberFormat('es').format(item.listeners) : null
  return (
    <article className={cn('flex flex-col gap-3 rounded-lg border-[1.5px] border-border bg-card p-4', className)}>
      <div className="flex flex-col gap-1">
        <strong className="font-display text-lg">{item.name}</strong>
        <Text tone="muted" size="sm">
          Tu cuenta: <a className="underline" href={`https://www.instagram.com/${item.id}`} target="_blank" rel="noreferrer noopener">@{item.id} ↗</a>
          {listeners ? ` · ${listeners} oyentes en Last.fm` : ''}
        </Text>
        <Text size="sm">Dudo porque: {item.reason}.</Text>
      </div>
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <Chip key={t} variant="outline" className="px-2 py-0 text-xs">
              {t}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="md" disabled={busy} onClick={() => onDecide('accept')}>
          Sí, es este artista
        </Button>
        <Button size="md" variant="ghost" disabled={busy} onClick={() => onDecide('reject')}>
          No, descartar
        </Button>
      </div>
    </article>
  )
}
