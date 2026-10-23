import { cn } from '@/lib/utils'
import { Icon, type IconName } from './Icon'

const SIZES = { sm: 'size-8 rounded-[8px] [&_svg]:size-4', md: 'size-11 rounded-[12px] [&_svg]:size-5', lg: 'size-14 rounded-[14px] [&_svg]:size-7' }

/**
 * Icono de una temática sobre su color suave. El color sale de `data-domain`: si se pasa
 * `domain`, el propio icono lo fija; si no, hereda el del marco.
 */
export function DomainIcon({ icon, domain, size = 'md', className }: { icon: IconName; domain?: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span data-domain={domain} aria-hidden className={cn('grid flex-none place-items-center bg-domain-soft text-domain', SIZES[size], className)}>
      <Icon name={icon} />
    </span>
  )
}
