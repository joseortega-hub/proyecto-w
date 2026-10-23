import { Outlet } from 'react-router'
import { AppHeader, BottomNav, MiniPlayer, PlayerBar, SideNav } from '@/components/organisms'
import { usePlayer } from '@/player/player-context'

/** Marco con navegación: inferior + mini-reproductor en móvil; lateral + barra en escritorio. */
export function AppShell() {
  const player = usePlayer()
  const { current } = player
  return (
    <div className="flex h-dvh">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </main>
        {current && (
          <>
            <MiniPlayer entry={current} playing={player.playing} onToggle={player.toggle} />
            <PlayerBar
              entry={current}
              playing={player.playing}
              onToggle={player.toggle}
              position={player.position}
              duration={player.duration || current.item.durationSec || 0}
              hasPrevious={player.index > 0}
              hasNext={player.index < player.queue.length - 1}
              onPrevious={player.previous}
              onNext={player.next}
              onSeek={player.seek}
            />
          </>
        )}
        <BottomNav />
      </div>
    </div>
  )
}
