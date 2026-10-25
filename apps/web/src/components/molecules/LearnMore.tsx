import { Icon, SiteIcon, Text } from '@/components/atoms'
import type { EntityLinks } from '@/lib/api'
import { SITE_LABELS, linkHost } from '@/lib/links'
import { cn } from '@/lib/utils'

interface LearnMoreProps {
  links: EntityLinks
  className?: string
}

/**
 * "Para saber más": las mejores webs sobre lo que gira la lista o la ficha (web oficial, wiki de
 * fans, Wikipedia, su página en el catálogo, comunidad y redes). Sin enlaces no se muestra.
 */
export function LearnMore({ links, className }: LearnMoreProps) {
  if (!links.entity || links.links.length === 0) return null
  return (
    <section className={cn('flex flex-col gap-2', className)} aria-label={`Para saber más sobre ${links.entity.label}`}>
      <div className="flex flex-col gap-0.5">
        <Text font="label">Para saber más</Text>
        <Text size="sm" tone="muted">
          Webs sobre {links.entity.label}
        </Text>
      </div>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
        {links.links.map((l) => (
          <li key={l.url}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-2.5 rounded-[12px] border border-border px-2.5 py-1.5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            >
              <SiteIcon site={l.site} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-bold">{SITE_LABELS[l.site]}</span>
                <span className="truncate text-[12px] text-muted-foreground">{linkHost(l.url)}</span>
              </span>
              <Icon name="external" className="size-4 text-muted-foreground" />
              <span className="sr-only">(se abre en una pestaña nueva)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
