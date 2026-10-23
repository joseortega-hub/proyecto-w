import { Link, NavLink } from 'react-router'
import { Heading, Icon, IconButton, type IconName } from '@/components/atoms'
import { useDomain } from '@/lib/domain'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { DomainSwitcher } from './DomainSwitcher'

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: '', label: 'Inicio', icon: 'home' },
  { to: 'biblioteca', label: 'Biblioteca', icon: 'library' },
  { to: 'listas', label: 'Mis listas', icon: 'lists' },
  { to: 'gustos', label: 'Mis gustos', icon: 'heart' },
]

/** Los enlaces se quedan dentro del dominio actual. */
function useLinks() {
  const { path } = useDomain()
  return LINKS.map((l) => ({ ...l, to: path(l.to), end: l.to === '' }))
}

/** Navegación inferior del móvil (< 768 px). */
export function BottomNav() {
  const links = useLinks()
  return (
    <nav aria-label="Principal" className="grid grid-cols-4 border-t border-border bg-card pt-2 pb-[max(env(safe-area-inset-bottom),14px)] md:hidden">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 flex-col items-center gap-[3px] p-1 text-xs',
              isActive ? 'font-bold text-accent-foreground' : 'text-muted-foreground',
            )
          }
        >
          <Icon name={l.icon} className="size-[22px]" />
          {l.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Navegación lateral a partir de 768 px. */
export function SideNav() {
  const { theme, toggle } = useTheme()
  const links = useLinks()
  return (
    <nav aria-label="Principal" className="hidden w-60 flex-none flex-col gap-1 border-r border-border bg-card p-4 md:flex">
      <Link to="/" className="rounded-sm px-3 pt-2 pb-6">
        <Heading as="span" size="brand">
          Sintonía
        </Heading>
      </Link>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] transition-colors',
              isActive ? 'bg-accent font-bold text-accent-foreground' : 'text-muted-foreground hover:bg-secondary',
            )
          }
        >
          <Icon name={l.icon} />
          {l.label}
        </NavLink>
      ))}
      <div className="mt-6 flex flex-col gap-1">
        <span className="label-caps px-3 pb-1">Temáticas</span>
        <DomainSwitcher orientation="vertical" />
      </div>
      <div className="mt-auto">
        <IconButton icon="theme" label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle} />
      </div>
    </nav>
  )
}
