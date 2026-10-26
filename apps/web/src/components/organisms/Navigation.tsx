import { useRef } from 'react'
import { Link, NavLink } from 'react-router'
import { Heading, Icon, type IconName } from '@/components/atoms'
import { useDomain } from '@/lib/domain'
import { cycleIndex, swipeStep } from '@/lib/layout'
import { cn } from '@/lib/utils'
import { DomainSwitcher, useDomainTabs } from './DomainSwitcher'
import { SettingsMenu } from './SettingsMenu'

// Las secciones de cada temática. «Tu historia», «Bajo el capó» y el buzón no son de una
// temática: viven en el menú de ajustes (⋯), así cada barra tiene solo lo que cambia con ella.
const LINKS: { to: string; label: string; short: string; icon: IconName }[] = [
  { to: '', label: 'Inicio', short: 'Inicio', icon: 'home' },
  { to: 'biblioteca', label: 'Biblioteca', short: 'Biblioteca', icon: 'library' },
  { to: 'listas', label: 'Mis listas', short: 'Listas', icon: 'lists' },
  { to: 'gustos', label: 'Mis gustos', short: 'Gustos', icon: 'heart' },
]

/** Los enlaces se quedan dentro del dominio actual. */
function useLinks() {
  const { path } = useDomain()
  return LINKS.map((l) => ({ ...l, to: path(l.to), end: l.to === '' }))
}

const Brand = () => (
  <Link to="/" aria-label="Sintonía: Hoy para ti" className="inline-flex min-h-11 items-center rounded-sm">
    <Heading as="span" size="brand">
      Sintonía
    </Heading>
  </Link>
)

/** Barra inferior del móvil (< 768 px): las cuatro secciones de la temática. */
export function BottomNav() {
  const links = useLinks()
  return (
    <nav aria-label="Secciones" className="grid flex-none grid-cols-4 gap-0.5 border-t border-border bg-card pt-1.5 pb-[max(env(safe-area-inset-bottom),12px)] short:pt-0 short:pb-[env(safe-area-inset-bottom)] md:hidden">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 min-w-0 flex-col items-center justify-center gap-[3px] px-0.5 py-1 text-center text-xs leading-tight short:flex-row short:gap-2',
              isActive ? 'font-bold text-domain' : 'text-muted-foreground',
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

/** Pestañas de sección bajo la cabecera (estructura «Biblioteca» en el móvil): sin barra abajo. */
export function TopTabs() {
  const links = useLinks()
  return (
    <nav aria-label="Secciones" className="flex flex-none border-b border-border px-3 md:hidden">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cn(
              'relative flex min-h-11 min-w-0 flex-1 items-center justify-center px-1 text-[14px] transition-colors motion-reduce:transition-none',
              'after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:transition-colors motion-reduce:after:transition-none',
              isActive ? 'font-bold text-foreground after:bg-domain' : 'text-muted-foreground after:bg-transparent hover:text-foreground',
            )
          }
        >
          <span className="truncate">{l.short}</span>
        </NavLink>
      ))}
    </nav>
  )
}

/** Navegación lateral a partir de 768 px: secciones, temáticas y, abajo, el menú de ajustes. */
export function SideNav() {
  const links = useLinks()
  return (
    <nav aria-label="Principal" className="hidden w-60 flex-none flex-col gap-1 overflow-y-auto overscroll-contain border-r border-border bg-card p-4 md:flex">
      <div className="px-3 pt-2 pb-6">
        <Brand />
      </div>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] transition-colors motion-reduce:transition-none',
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
        <DomainSwitcher />
      </div>
      <div className="mt-auto pt-4">
        <SettingsMenu side="top" align="start">
          <button type="button" className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-[15px] text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <Icon name="more" />
            Ajustes y más
          </button>
        </SettingsMenu>
      </div>
    </nav>
  )
}

/**
 * Estructura «Biblioteca» en pantallas grandes: carril de iconos a la izquierda desde 768 px y,
 * desde 1024 px, una columna con las temáticas (como la biblioteca de una app de música).
 */
export function RailNav() {
  const links = useLinks()
  return (
    <div className="hidden flex-none border-r border-border bg-card md:flex">
      <nav aria-label="Principal" className="flex w-20 flex-col items-center gap-1 overflow-y-auto overscroll-contain pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
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
                'flex min-h-14 w-16 flex-col items-center justify-center gap-1 rounded-[14px] px-1 text-center text-[11px] leading-tight transition-colors motion-reduce:transition-none',
                isActive ? 'bg-accent font-bold text-accent-foreground' : 'text-muted-foreground hover:bg-secondary',
              )
            }
          >
            <Icon name={l.icon} className="size-[22px] flex-none" />
            <span className="line-clamp-2 max-w-full">{l.short}</span>
          </NavLink>
        ))}
        <div className="mt-auto hidden pt-4 lg:block">
          <SettingsMenu side="right" align="end" />
        </div>
      </nav>
      <div className="hidden w-60 flex-col gap-1 overflow-y-auto overscroll-contain border-l border-border p-4 lg:flex">
        <div className="px-3 pt-2 pb-6">
          <Brand />
        </div>
        <span className="label-caps px-3 pb-1">Temáticas</span>
        <DomainSwitcher />
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
          'flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-bold transition-[background-color,color] duration-200 ease-standard motion-reduce:transition-none',
          isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={l.icon} className="size-[22px] flex-none" />
          {isActive && <span className="hidden max-w-[6rem] truncate min-[400px]:inline">{l.short}</span>}
        </>
      )}
    </NavLink>
  )
  return (
    <div className="flex-none px-3 pt-1 pb-[max(env(safe-area-inset-bottom),12px)] short:pb-[max(env(safe-area-inset-bottom),4px)]">
      <nav
        aria-label="Secciones"
        className="mx-auto flex w-full max-w-md items-center justify-around gap-0.5 rounded-full border border-border bg-card/90 p-1 shadow-lg backdrop-blur-md"
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

/**
 * Estructura «Una mano» (móvil): sin cabecera, todo abajo. A la izquierda la temática (toca
 * para elegir o desliza la barra a los lados para pasar a la siguiente), tres secciones y «Más»
 * con «Mis gustos», «Hoy para ti» y los ajustes.
 */
export function ThumbNav() {
  const links = useLinks()
  const { tabs, current, select } = useDomainTabs()
  const start = useRef<{ x: number; y: number } | null>(null)
  const swipe = (dx: number, dy: number) => {
    const step = swipeStep(dx, dy)
    if (!step || tabs.length < 2) return
    const index = tabs.findIndex((t) => t.id === current)
    select(tabs[cycleIndex(Math.max(index, 0), step, tabs.length)]!.id)
  }
  const tab = 'flex min-h-12 min-w-0 flex-col items-center justify-center gap-[3px] px-0.5 py-1 text-center text-xs leading-tight'
  return (
    <nav
      aria-label="Secciones"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        if (start.current) swipe(e.clientX - start.current.x, e.clientY - start.current.y)
        start.current = null
      }}
      onPointerCancel={() => {
        start.current = null
      }}
      className="grid flex-none touch-pan-y grid-cols-5 gap-0.5 border-t border-border bg-card pt-1.5 pb-[max(env(safe-area-inset-bottom),12px)] short:pt-0 short:pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {tabs.length >= 2 ? (
        <DomainSwitcher variant="tab" className="w-full" />
      ) : (
        <Link to="/" className={cn(tab, 'text-muted-foreground')}>
          <Icon name="sparkles" className="size-[22px] flex-none" />
          <span>Hoy</span>
        </Link>
      )}
      {links.slice(0, 3).map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => cn(tab, isActive ? 'font-bold text-foreground' : 'text-muted-foreground')}>
          <Icon name={l.icon} className="size-[22px] flex-none" />
          <span className="max-w-full truncate">{l.short}</span>
        </NavLink>
      ))}
      <SettingsMenu
        side="top"
        align="end"
        extraLinks={[
          { to: links[3]!.to, label: links[3]!.label, icon: links[3]!.icon },
          { to: '/', label: 'Hoy para ti', icon: 'sparkles' },
        ]}
      >
        <button type="button" className={cn(tab, 'text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none')}>
          <Icon name="more" className="size-[22px] flex-none" />
          <span>Más</span>
        </button>
      </SettingsMenu>
    </nav>
  )
}
