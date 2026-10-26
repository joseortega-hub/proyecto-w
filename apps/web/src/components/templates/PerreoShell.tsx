import type { CSSProperties } from 'react'
import { Outlet } from 'react-router'
import { MiniPlayer, PerreoBottomNav, PerreoSideNav, PerreoTopBar, PlayerBar } from '@/components/organisms'
import { usePerreoArtist, usePerreoUnlock } from '@/lib/perreo'
import { usePlayer } from '@/player/player-context'
import '@/styles/perreo.css'

/**
 * Marco propio del Modo Perreo: noche de escenario con el color de «tu» artista (el que abrió el modo)
 * como único acento, cartel arriba, cápsula de navegación abajo en el móvil y riel lateral en escritorio.
 * El reproductor es el de siempre, para que la música siga al entrar y salir.
 */
export function PerreoShell() {
  const player = usePlayer()
  const { current } = player
  const unlock = usePerreoUnlock()
  const mine = usePerreoArtist(unlock?.slug)
  const color = mine.data?.artist.color ?? '#ff4fd0'
  const nickname = unlock?.nickname || mine.data?.artist.name
  return (
    <div className="pt-safe px-safe relative flex h-dvh text-white" data-domain="perreo" data-perreo-ui="" style={{ '--artist': color } as CSSProperties}>
      <PerreoSideNav nickname={nickname} />
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
        <PerreoTopBar nickname={nickname} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
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
        <PerreoBottomNav />
      </div>
    </div>
  )
}
