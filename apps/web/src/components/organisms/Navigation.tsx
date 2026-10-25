import { Link, NavLink, useNavigate } from 'react-router'
import { Heading, Icon, IconButton, type IconName } from '@/components/atoms'
import { useDomain } from '@/lib/domain'
import { useTheme } from '@/lib/theme'
import { openFeedback } from '@/lib/feedback'
import { cn } from '@/lib/utils'
import { DomainSwitcher } from './DomainSwitcher'
import { CustomizeMenu } from './CustomizeMenu'
import { ThemeMenu } from './ThemeMenu'

const LINKS: { to: string; label: string; icon: IconName }[] = [
  { to: '', label: 'Inicio', icon: 'home' },
  { to: 'biblioteca', label: 'Biblioteca', icon: 'library' },
  { to: 'listas', label: 'Mis listas', icon: 'lists' },
  { to: 'gustos', label: 'Mis gustos', icon: 'heart' },
  { to: '/historia', label: 'Tu historia', icon: 'calendar' },
]

/** Los enlaces se quedan dentro del dominio actual. */
function useLinks() {
  const { path, id } = useDomain()
  // Las rutas que empiezan por «/» son globales («Tu historia») y no cuelgan de la temática.
  const links: typeof LINKS = id === 'perreo' ? LINKS.map((l) => (l.to === 'gustos' ? { to: 'artistas', label: 'Artistas', icon: 'users' as const } : l)) : LINKS
  return links.map((l) => ({ ...l, to: l.to.startsWith('/') ? l.to : path(l.to), end: l.to === '' }))
}

/** Navegación inferior del móvil (< 768 px). */
export function BottomNav() {
  const links = useLinks()
  return (
    <nav aria-label="Principal" className="grid flex-none grid-cols-5 gap-0.5 border-t border-border bg-card pt-2 pb-[max(env(safe-area-inset-bottom),14px)] short:pt-0 short:pb-[env(safe-area-inset-bottom)] md:hidden">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 min-w-0 flex-col items-center justify-center gap-[3px] px-0.5 py-1 text-center text-[11px] leading-tight min-[360px]:text-xs short:flex-row short:gap-2',
              isActive ? 'font-bold text-accent-foreground' : 'text-muted-foreground',
            )
          }
        >
          <Icon name={l.icon} className="size-[22px] flex-none" />
          <span className="max-w-full truncate">{l.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

/** Navegación lateral a partir de 768 px. */
export function SideNav() {
  const { theme, toggle } = useTheme()
  const links = useLinks()
  const navigate = useNavigate()
  return (
    <nav aria-label="Principal" className="hidden w-60 flex-none flex-col gap-1 overflow-y-auto overscroll-contain border-r border-border bg-card p-4 md:flex">
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
      <div className="mt-auto flex flex-wrap gap-1">
        <ThemeMenu side="top" align="start" />
        <CustomizeMenu side="top" align="start" />
        <IconButton icon="feedback" variant="ghost" label="Buzón de comentarios" onClick={openFeedback} />
        <IconButton icon="theme" label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle} />
        <IconButton icon="activity" variant="ghost" label="Bajo el capó: la IA por dentro" onClick={() => navigate('/bajo-el-capo')} />
      </div>
    </nav>
  )
}

/** Atajos de estilo y personalización (en la barra lateral, el carril y la cabecera). */
function ToolButtons({ side = 'top' }: { side?: 'top' | 'right' }) {
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  return (
    <>
      <ThemeMenu side={side} align="end" />
      <CustomizeMenu side={side} align="end" />
      <IconButton icon="feedback" variant="ghost" label="Buzón de comentarios" onClick={openFeedback} />
      <IconButton icon="theme" label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle} />
      <IconButton icon="activity" variant="ghost" label="Bajo el capó: la IA por dentro" onClick={() => navigate('/bajo-el-capo')} />
    </>
  )
}

/**
 * Estructura «Biblioteca»: carril de iconos a la izquierda en todas las pantallas y, desde
 * 1024 px, una columna con las temáticas (como la biblioteca de una app de música).
 */
export function RailNav() {
  const links = useLinks()
  return (
    <div className="flex flex-none border-r border-border bg-card">
      <nav aria-label="Principal" className="flex w-[68px] flex-col items-center gap-1 overflow-y-auto overscroll-contain pt-3 pb-[max(env(safe-area-inset-bottom),12px)] md:w-20">
        <Link to="/" aria-label="Sintonía: Hoy para ti" className="mb-2 grid size-11 place-items-center rounded-full bg-primary font-display text-lg font-extrabold text-primary-foreground">
          S
        </Link>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              cn(
                'flex min-h-14 w-14 flex-col items-center justify-center gap-1 rounded-[14px] px-1 text-center text-[10px] leading-tight transition-colors motion-reduce:transition-none md:w-16 md:text-[11px]',
                isActive ? 'bg-accent font-bold text-accent-foreground' : 'text-muted-foreground hover:bg-secondary',
              )
            }
          >
            <Icon name={l.icon} className="size-[22px] flex-none" />
            <span className="line-clamp-2 max-w-full">{l.label}</span>
          </NavLink>
        ))}
        <div className="mt-auto hidden flex-col items-center gap-2 pt-4 lg:flex">
          <ToolButtons side="right" />
        </div>
      </nav>
      <div className="hidden w-60 flex-col gap-1 overflow-y-auto overscroll-contain border-l border-border p-4 lg:flex">
        <Link to="/" className="rounded-sm px-3 pt-2 pb-6">
          <Heading as="span" size="brand">
            Sintonía
          </Heading>
        </Link>
        <span className="label-caps px-3 pb-1">Temáticas</span>
        <DomainSwitcher orientation="vertical" />
      </div>
    </div>
  )
}

/**
 * Estructura «Dock»: barra flotante en forma de píldora. La pestaña activa enseña su nombre;
 * las demás, solo el icono. En el centro, una entrevista nueva a un toque.
 */
export function DockNav() {
  const links = useLinks()
  const { path } = useDomain()
  const item = (l: (typeof links)[number]) => (
    <NavLink
      key={l.to}
      to={l.to}
      end={l.end}
      aria-label={l.label}
      title={l.label}
      className={({ isActive }) =>
        cn(
          'flex h-12 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition-[background-color,color,padding] duration-200 ease-standard motion-reduce:transition-none',
          isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={l.icon} className="size-[22px] flex-none" />
          {isActive && <span className="hidden max-w-[7rem] truncate min-[400px]:inline">{l.label}</span>}
        </>
      )}
    </NavLink>
  )
  return (
    <div className="flex-none px-3 pt-1 pb-[max(env(safe-area-inset-bottom),12px)] short:pb-[max(env(safe-area-inset-bottom),4px)]">
      <nav
        aria-label="Principal"
        className="mx-auto flex w-full max-w-lg items-center justify-between gap-0.5 rounded-full border border-border bg-card/90 p-1 shadow-lg backdrop-blur-md"
      >
        {links.slice(0, 2).map(item)}
        <Link
          to={path('entrevista')}
          aria-label="Nueva entrevista"
          title="Nueva entrevista"
          className="grid size-13 flex-none -translate-y-2 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform duration-200 ease-standard hover:scale-105 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:scale-100"
        >
          <Icon name="sparkles" className="size-6" />
        </Link>
        {links.slice(2).map(item)}
      </nav>
    </div>
  )
}
