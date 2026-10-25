import { Outlet } from 'react-router'
import { AppHeader, BottomNav, DockNav, MiniPlayer, PlayerBar, RailNav, SideNav } from '@/components/organisms'
import { useDomain } from '@/lib/domain'
import { useLayout } from '@/lib/layout'
import { cn } from '@/lib/utils'
import { usePlayer } from '@/player/player-context'

/**
 * Marco con navegación, en la estructura que elija la persona («Personalizar»):
 * - Clásica: inferior + mini-reproductor en móvil; lateral + barra en escritorio.
 * - Biblioteca: carril de iconos a la izquierda (y columna de temáticas desde 1024 px).
 * - Dock: cabecera arriba y una barra flotante abajo, en todas las pantallas.
 */
export function AppShell() {
  const player = usePlayer()
  const { current } = player
  const domain = useDomain()
  const { layout } = useLayout()
  return (
    // data-domain fija el color de la temática para todo lo que hay dentro. El marco va fijo a
    // la pantalla (sin depender de 100vh/dvh): solo se desplaza <main>, así el rebote del móvil
    // no arrastra la barra de navegación ni deja huecos debajo.
    <div className="pt-safe px-safe fixed inset-0 flex overflow-hidden" data-domain={domain.id} data-layout={layout}>
      {layout === 'app' && <SideNav />}
      {layout === 'library' && <RailNav />}
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', layout === 'library' && 'pb-[env(safe-area-inset-bottom)]')}>
        <AppHeader hideFrom={layout === 'app' ? 'md' : layout === 'library' ? 'lg' : 'never'} />
        <main className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
        {current && (
          <>
            <MiniPlayer entry={current} playing={player.playing} onToggle={player.toggle} shuffle={player.order !== null} repeat={player.repeat} onShuffle={player.toggleShuffle} onRepeat={player.cycleRepeat} onClose={player.stop} />
            <PlayerBar
              entry={current}
              playing={player.playing}
              onToggle={player.toggle}
              position={player.position}
              duration={player.duration || current.item.durationSec || 0}
              hasPrevious={player.hasPrevious}
              hasNext={player.hasNext}
              shuffle={player.order !== null}
              repeat={player.repeat}
              onShuffle={player.toggleShuffle}
              onRepeat={player.cycleRepeat}
              onPrevious={player.previous}
              onNext={player.next}
              onSeek={player.seek}
              onClose={player.stop}
            />
          </>
        )}
        {layout === 'app' && <BottomNav />}
        {layout === 'dock' && <DockNav />}
      </div>
    </div>
  )
}
