import { Link, NavLink } from 'react-router'
import { Icon, type IconName } from '@/components/atoms'
import { cn } from '@/lib/utils'
import '@/styles/perreo.css'

/** Secciones del Modo Perreo: su propio mapa, nada que ver con el de Sintonía. */
export const PERREO_SECTIONS: { to: string; label: string; long: string; icon: IconName }[] = [
  { to: '/perreo', label: 'El Bloque', long: 'El Bloque', icon: 'home' },
  { to: '/perreo/artistas', label: 'La Calle', long: 'La Calle · artistas', icon: 'users' },
  { to: '/perreo/novedades', label: 'Lo Nuevo', long: 'Lo Nuevo · lanzamientos', icon: 'sparkles' },
  { to: '/perreo/caliente', label: 'Fuego', long: 'Fuego · lo más caliente', icon: 'flame' },
  { to: '/perreo/cara-a-cara', label: '1 vs 1', long: 'Cara a cara', icon: 'activity' },
]

const EXTRA: { to: string; label: string; icon: IconName }[] = [
  { to: '/perreo/listas', label: 'Mis listas', icon: 'lists' },
  { to: '/perreo/biblioteca', label: 'Biblioteca', icon: 'library' },
]

/** Móvil: cápsula flotante; la sección activa salta como una pegatina del color del artista. */
export function PerreoBottomNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Modo Perreo" className={cn('px-3 pt-1 pb-[max(env(safe-area-inset-bottom),10px)] md:hidden', className)}>
      <div className="grid grid-cols-5 rounded-[22px] border border-white/10 bg-black/70 px-1 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md">
        {PERREO_SECTIONS.map((s) => (
          <NavLink key={s.to} to={s.to} end={s.to === '/perreo'} className="perreo-tab flex min-h-12 min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-0.5 text-center focus-visible:outline-2 focus-visible:outline-[var(--artist)]">
            {({ isActive }) => (
              <>
                <span className="perreo-tab-icon grid size-9 place-items-center rounded-xl text-white/80">
                  <Icon name={s.icon} className="size-[20px]" />
                </span>
                <span className={cn('font-poster max-w-full truncate text-[13px] tracking-wide min-[360px]:text-[15px]', isActive ? 'text-[var(--artist)]' : 'text-white/70')}>{s.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Escritorio: riel lateral con el cartel del modo, las secciones y la salida a Sintonía. */
export function PerreoSideNav({ nickname, className }: { nickname?: string; className?: string }) {
  return (
    <nav aria-label="Modo Perreo" className={cn('relative z-[1] hidden w-64 flex-none flex-col gap-1 border-r border-white/10 bg-black/40 p-4 backdrop-blur md:flex', className)}>
      <Link to="/perreo" className="mb-5 flex flex-col rounded-sm px-2 pt-1">
        <span className="font-poster perreo-neon -rotate-2 text-5xl text-white">
          MODO <span className="text-[var(--artist)]">PERREO</span>
        </span>
        {nickname && <span className="mt-1 text-sm text-white/60">de {nickname} 🔥</span>}
      </Link>
      {PERREO_SECTIONS.map((s) => (
        <NavLink
          key={s.to}
          to={s.to}
          end={s.to === '/perreo'}
          className={({ isActive }) =>
            cn('perreo-tab flex min-h-11 items-center gap-3 rounded-lg px-2 text-[15px] transition-colors', isActive ? 'bg-white/5 font-bold text-white' : 'text-white/70 hover:bg-white/5')
          }
        >
          <span className="perreo-tab-icon grid size-8 place-items-center rounded-lg">
            <Icon name={s.icon} className="size-[18px]" />
          </span>
          {s.long}
        </NavLink>
      ))}
      <div className="mt-6 flex flex-col gap-1 border-t border-white/10 pt-4">
        {EXTRA.map((s) => (
          <NavLink key={s.to} to={s.to} className={({ isActive }) => cn('flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm', isActive ? 'text-white' : 'text-white/60 hover:text-white')}>
            <Icon name={s.icon} className="size-4" />
            {s.label}
          </NavLink>
        ))}
      </div>
      <Link to="/" className="mt-auto flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-white/60 hover:text-white">
        <Icon name="back" className="size-4" /> Volver a Sintonía
      </Link>
    </nav>
  )
}

/** Cabecera del móvil: cartel del modo, accesos a tus listas y salida. */
export function PerreoTopBar({ nickname, className }: { nickname?: string; className?: string }) {
  return (
    <header className={cn('relative z-[1] flex items-center justify-between gap-2 px-4 pt-3 pb-1 md:hidden', className)}>
      <Link to="/perreo" className="flex min-h-11 min-w-0 items-baseline gap-2 rounded-sm">
        <span className="font-poster perreo-neon -rotate-2 text-[34px] text-white">
          MODO <span className="text-[var(--artist)]">PERREO</span>
        </span>
        {nickname && <span className="truncate text-xs text-white/60">de {nickname}</span>}
      </Link>
      <div className="flex flex-none items-center gap-1">
        <Link to="/perreo/listas" aria-label="Mis listas" className="grid size-11 place-items-center rounded-full text-white/80 hover:bg-white/10">
          <Icon name="lists" />
        </Link>
        <Link to="/" aria-label="Volver a Sintonía" className="grid size-11 place-items-center rounded-full text-white/80 hover:bg-white/10">
          <Icon name="close" />
        </Link>
      </div>
    </header>
  )
}
