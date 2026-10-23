import { DomainIcon, Icon, type IconName } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface DomainCardProps {
  id: string
  name: string
  icon: IconName
  /** "803 canciones de Jamendo" o "Próximamente". */
  description: string
  disabled?: boolean
  onSelect?: () => void
  className?: string
}

/** Tarjeta de una temática en el selector de Inicio, con su icono y su color. */
export function DomainCard({ id, name, icon, description, disabled, onSelect, className }: DomainCardProps) {
  return (
    <button
      type="button"
      data-domain={id}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'group flex min-h-20 w-full items-center gap-3.5 rounded-[14px] border-[1.5px] border-border bg-card px-4 py-3 text-left transition-colors',
        'enabled:hover:border-domain enabled:hover:bg-domain-soft disabled:opacity-60',
        className,
      )}
    >
      <DomainIcon icon={icon} size="lg" />
      <span className="flex min-w-0 flex-1 flex-col">
        <strong className="font-display text-xl font-extrabold">{name}</strong>
        <span className="truncate text-[13px] text-muted-foreground">{description}</span>
      </span>
      {!disabled && <Icon name="back" className="size-5 rotate-180 text-muted-foreground group-hover:text-domain" />}
    </button>
  )
}
