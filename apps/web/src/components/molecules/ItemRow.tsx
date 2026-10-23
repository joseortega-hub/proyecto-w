import type { ReactNode } from 'react'
import { Cover, Icon, MatchBadge } from '@/components/atoms'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

interface ItemRowProps {
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  durationSec?: number | null
  match?: number
  active?: boolean
  playing?: boolean
  onSelect?: () => void
  /** Qué hace el toque, para lectores de pantalla ("Ver la ficha de"). Por defecto, reproducir o pausar. */
  actionLabel?: string
  /** Contenido extra bajo la fila (p. ej. la explicación). */
  children?: ReactNode
  className?: string
}

/** Un elemento del catálogo en una lista: portada, título, autor y encaje. */
export function ItemRow({ title, subtitle, imageUrl, durationSec, match, active, playing, onSelect, actionLabel, children, className }: ItemRowProps) {
  const content = (
    <>
      <div className="relative size-12 flex-none">
        <Cover src={imageUrl} alt={`Portada de ${title}`} className="size-12 rounded-[8px]" />
        {active && (
          <span className="absolute inset-0 grid place-items-center rounded-[8px] bg-foreground/45 text-background">
            <Icon name={playing ? 'pause' : 'play'} className="size-4" />
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col text-left">
        <strong className={cn('truncate text-[15px]', active && 'text-accent-foreground')}>{title}</strong>
        <span className="truncate text-[13px] text-muted-foreground">
          {subtitle}
          {durationSec ? <> · <span className="font-mono tabular-nums">{formatDuration(durationSec)}</span></> : null}
        </span>
      </div>
      {match !== undefined && <MatchBadge value={match} />}
    </>
  )

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-current={active ? 'true' : undefined}
          aria-label={`${actionLabel ?? (active && playing ? 'Pausar' : 'Reproducir')} ${title}`}
          className="flex min-h-14 w-full items-center gap-3 rounded-md text-left transition-colors hover:bg-secondary/60"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3">{content}</div>
      )}
      {children}
    </div>
  )
}
