import { DomainIcon, Text, type IconName } from '@/components/atoms'
import { cn } from '@/lib/utils'
import { ItemRow } from './ItemRow'

export interface ComboEntry {
  id: string
  title: string
  subtitle: string | null
  imageUrl: string | null
  /** El «por qué» de una línea. */
  reason: string
  onOpen: () => void
}

interface ComboSlotProps {
  domainId: string
  icon: IconName
  /** «Película», «Mi YouTube»… */
  name: string
  /** «para ahora», «para después», «para mañana». */
  role: string
  /** «Noche de sábado con lluvia: algo pausado». */
  why: string
  entries: ComboEntry[]
  className?: string
}

/** Un hueco del combo: la temática, para cuándo es y 1-2 elementos con su «por qué». */
export function ComboSlot({ domainId, icon, name, role, why, entries, className }: ComboSlotProps) {
  return (
    <section data-domain={domainId} className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2.5">
        <DomainIcon icon={icon} size="sm" />
        <div className="flex min-w-0 flex-col">
          <Text font="label" className="text-domain">
            {name} · {role}
          </Text>
          <Text size="xs" tone="muted" className="truncate">
            {why}
          </Text>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {entries.map((e) => (
          <li key={e.id}>
            <ItemRow title={e.title} subtitle={e.subtitle} imageUrl={e.imageUrl} detail={e.reason} onSelect={e.onOpen} actionLabel="Ver la ficha de" />
          </li>
        ))}
      </ul>
    </section>
  )
}
