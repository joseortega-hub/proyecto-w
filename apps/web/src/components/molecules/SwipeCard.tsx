import type { ComponentProps, CSSProperties, ReactNode } from 'react'
import { Cover, MatchBadge } from '@/components/atoms'
import { cn } from '@/lib/utils'
import { Explanation } from './Explanation'

interface SwipeCardProps extends Omit<ComponentProps<'article'>, 'title'> {
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  /** El «por qué» de la lista (o de la parecida). */
  reason?: string
  /** Gustos guardados con los que encaja. */
  likes?: string[]
  match?: number
  /** Dato breve (año, duración, plataforma…). */
  detail?: string | null
  /** Ya está en la lista (las extra todavía no). */
  inList?: boolean
  /** Reproducir o abrir en la fuente, según la temática. */
  actions?: ReactNode
  /** Debajo de las acciones («Ya la vi»). */
  footer?: ReactNode
}

/**
 * Tarjeta grande de «Desliza». Las marcas «Me gusta», «No» y «Ficha» se encienden con las
 * variables CSS `--like`, `--nope` y `--up` (0–1) que pone el gesto, sin volver a pintar React.
 */
export function SwipeCard({ title, subtitle, imageUrl, reason, likes, match, detail, inList = true, actions, footer, className, style, ...props }: SwipeCardProps) {
  const stamp = 'pointer-events-none absolute top-4 rounded-lg border-[3px] px-3 py-1 text-lg font-black uppercase tracking-wide bg-card/85'
  return (
    <article
      {...props}
      style={{ '--like': 0, '--nope': 0, '--up': 0, ...style } as CSSProperties}
      className={cn('relative flex w-full flex-col gap-3 overflow-hidden rounded-[22px] border border-border bg-card p-3.5 shadow-lg', className)}
    >
      <div className="relative">
        <Cover src={imageUrl} alt={`Portada de ${title}`} className="mx-auto w-full max-w-[min(100%,28dvh)] rounded-[16px]" />
        <span aria-hidden className={cn(stamp, 'left-4 -rotate-12 border-domain text-domain')} style={{ opacity: 'var(--like)' }}>
          Me gusta
        </span>
        <span aria-hidden className={cn(stamp, 'right-4 rotate-12 border-destructive text-destructive')} style={{ opacity: 'var(--nope)' }}>
          No
        </span>
        <span aria-hidden className={cn(stamp, 'left-1/2 top-auto bottom-4 -translate-x-1/2 border-foreground text-foreground')} style={{ opacity: 'var(--up)' }}>
          Ficha
        </span>
      </div>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          {!inList && <span className="mb-1 w-fit rounded-full bg-domain-soft px-2 py-0.5 text-[11px] font-bold text-domain">Nueva propuesta</span>}
          <h3 className="line-clamp-2 text-xl font-extrabold leading-tight">{title}</h3>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          {detail && <p className="truncate font-mono text-[12px] text-muted-foreground tabular-nums">{detail}</p>}
        </div>
        {match ? <MatchBadge value={match} className="mt-1 flex-none" /> : null}
      </div>
      {reason && <Explanation reason={reason} collapsible={false} />}
      {!!likes?.length && <p className="text-[13px] text-muted-foreground">❤️ Va con lo que te gusta: {likes.join(', ')}</p>}
      {actions && <div className="flex gap-2">{actions}</div>}
      {footer}
    </article>
  )
}
