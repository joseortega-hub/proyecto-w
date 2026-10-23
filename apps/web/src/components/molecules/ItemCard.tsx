import { Cover } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface ItemCardProps {
  title: string
  subtitle?: string | null
  /** Dato breve bajo el autor (año, duración…). */
  meta?: string | null
  imageUrl?: string | null
  onSelect?: () => void
  className?: string
}

/** Un elemento del catálogo en la cuadrícula de la biblioteca. */
export function ItemCard({ title, subtitle, meta, imageUrl, onSelect, className }: ItemCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('flex w-full min-w-0 flex-col gap-2 rounded-[14px] p-1.5 text-left transition-colors hover:bg-secondary/70', className)}
    >
      <Cover src={imageUrl} alt={`Portada de ${title}`} className="w-full rounded-[10px]" />
      <span className="flex min-w-0 flex-col px-0.5">
        <strong className="line-clamp-2 text-[14px] leading-tight">{title}</strong>
        {subtitle && <span className="truncate text-[12px] text-muted-foreground">{subtitle}</span>}
        {meta && <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{meta}</span>}
      </span>
    </button>
  )
}
