import { DomainIcon, Icon, type IconName } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface DomainTileProps {
  id: string
  name: string
  icon: IconName
  /** «803 canciones de Jamendo» o «Conecta tu YouTube». */
  description: string
  /** Última lista de esta temática: «Noche de after · hace 2 días». */
  lastList?: string | null
  /** «Continuar» si hay una entrevista abierta o una lista; sin nada, solo se abre la temática. */
  action?: { label: string; onClick: () => void } | null
  disabled?: boolean
  onOpen: () => void
  className?: string
}

/** Tarjeta de una temática en «Hoy para ti»: color propio, cuánto hay, la última lista y «Continuar». */
export function DomainTile({ id, name, icon, description, lastList, action, disabled, onOpen, className }: DomainTileProps) {
  return (
    <div
      data-domain={id}
      className={cn(
        'flex items-center gap-1 rounded-[14px] border-[1.5px] border-border bg-card pr-2 transition-colors',
        !disabled && 'hover:border-domain hover:bg-domain-soft',
        disabled && 'opacity-60',
        className,
      )}
    >
      <button type="button" disabled={disabled} onClick={onOpen} className="group flex min-h-20 min-w-0 flex-1 items-center gap-3.5 rounded-[14px] py-3 pr-1 pl-4 text-left">
        <DomainIcon icon={icon} size="lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          <strong className="font-display text-xl font-extrabold">{name}</strong>
          <span className="truncate text-[13px] text-muted-foreground">{description}</span>
          {lastList && (
            <span className="flex items-center gap-1 truncate text-[13px] text-domain">
              <Icon name="lists" className="size-3.5 flex-none" />
              <span className="truncate">{lastList}</span>
            </span>
          )}
        </span>
        {!disabled && !action && <Icon name="back" className="size-5 flex-none rotate-180 text-muted-foreground group-hover:text-domain" />}
      </button>
      {action && !disabled && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex min-h-11 flex-none items-center gap-1 rounded-full bg-domain-soft px-3.5 text-[14px] font-bold text-domain transition-colors hover:bg-domain hover:text-background"
        >
          {action.label}
          <Icon name="back" className="size-4 rotate-180" />
        </button>
      )}
    </div>
  )
}
