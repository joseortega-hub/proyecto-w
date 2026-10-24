import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { Heading, Icon, IconButton, type IconName } from '@/components/atoms'
import { ThemeMenu } from '@/components/organisms'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const LINKS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Hoy', icon: 'home', end: true },
  { to: '/historia', label: 'Tu historia', icon: 'calendar' },
]

/**
 * Marco de las pantallas que no son de una temática («Hoy para ti», «Tu historia»): cabecera
 * con marca, las dos pestañas, «Bajo el capó», estilo y modo claro/oscuro. Respeta zonas seguras.
 */
export function GlobalShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  return (
    // `px-safe` va en el marco de fuera: como utilidad propia pisaría al padding de dentro.
    <div className="pt-safe px-safe min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 pb-8 md:px-10">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 short:py-1">
          <Link to="/" className="inline-flex min-h-11 items-center rounded-sm">
            <Heading as="span" size="brand">
              Sintonía
            </Heading>
          </Link>
          <nav aria-label="Principal" className="order-last flex w-full gap-1 md:order-none md:w-auto">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-[15px] md:flex-none',
                    isActive ? 'bg-accent font-bold text-accent-foreground' : 'text-muted-foreground hover:bg-secondary',
                  )
                }
              >
                <Icon name={l.icon} className="size-[18px]" />
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex gap-2">
            <IconButton icon="activity" variant="ghost" label="Bajo el capó: la IA por dentro" onClick={() => navigate('/bajo-el-capo')} />
            <ThemeMenu />
            <IconButton icon="theme" label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle} />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-5 pt-2">{children}</main>
      </div>
    </div>
  )
}
