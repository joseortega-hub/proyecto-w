import { Button, Icon, Skeleton } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface YearStoryCardProps {
  /** URL de la imagen 9:16; sin ella, esqueleto. */
  src?: string
  alt: string
  /** «2 de 7». */
  position: string
  sharing?: boolean
  onShare: () => void
  className?: string
}

/** Una tarjeta de «Tu año en Sintonía» (formato historia 9:16) con su botón de compartir. */
export function YearStoryCard({ src, alt, position, sharing, onShare, className }: YearStoryCardProps) {
  return (
    <figure aria-roledescription="tarjeta" aria-label={position} className={cn('relative flex flex-none snap-center flex-col items-center gap-3', className)}>
      <div className="aspect-[9/16] h-[min(68dvh,760px)] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-[22px] bg-secondary shadow-lg">
        {src ? <img src={src} alt={alt} className="size-full object-cover" /> : <Skeleton className="size-full rounded-none" aria-label="Preparando la tarjeta" />}
      </div>
      <Button size="md" variant="secondary" disabled={!src || sharing} onClick={onShare}>
        <Icon name="share" /> {sharing ? 'Preparando…' : 'Compartir'}
      </Button>
    </figure>
  )
}
