import { Icon } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface SourceAttributionProps {
  name: string
  url: string
  attribution: string
  className?: string
}

/** Atribución obligatoria de la fuente de datos (RAWG, TMDB…) con enlace a ella. */
export function SourceAttribution({ name, url, attribution, className }: SourceAttributionProps) {
  return (
    <p className={cn('text-[12px] text-muted-foreground', className)}>
      {attribution}{' '}
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-bold text-foreground underline-offset-2 hover:underline">
        {name}
        <Icon name="external" className="size-3" />
      </a>
    </p>
  )
}
