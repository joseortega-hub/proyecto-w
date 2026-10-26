import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { AppHeader, BottomNav, DockNav, MiniPlayer, PlayerBar, RailNav, SideNav, ThumbNav, TopTabs } from '@/components/organisms'
import { useDomain } from '@/lib/domain'
import { nextChrome, useLayout, type ChromeState } from '@/lib/layout'
import { cn } from '@/lib/utils'
import { usePlayer } from '@/player/player-context'

/** Plegable sin medir alturas: la fila de la rejilla pasa de 1fr a 0fr (sin animación si se pide menos movimiento). */
function Collapsible({ hidden, onFocus, children }: { hidden: boolean; onFocus: () => void; children: ReactNode }) {
  return (
    <div
      onFocusCapture={onFocus}
      className={cn('grid flex-none transition-[grid-template-rows] duration-200 ease-standard motion-reduce:transition-none', hidden ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

/**
 * Marco con navegación, en la estructura que elija la persona («Personalizar»). En el móvil:
 * - Clásica: cabecera fina arriba y cuatro secciones abajo.
 * - Biblioteca: cabecera y pestañas de sección arriba; abajo, nada más que el contenido.
 * - Dock: cabecera y una barra flotante con la entrevista nueva en el centro.
 * - Una mano: sin cabecera; temática, secciones y «Más» en la barra de abajo.
 * - Enfoque: como la Clásica, pero las barras se esconden al bajar y vuelven al subir.
 * En el ordenador, menú lateral (Clásica, Una mano y Enfoque), carril con columna de
 * temáticas (Biblioteca) o la misma barra flotante (Dock).
 */
export function AppShell() {
  const player = usePlayer()
  const { current } = player
  const domain = useDomain()
  const { layout } = useLayout()
  const { pathname } = useLocation()
  const focus = layout === 'focus'
  const chrome = useRef<ChromeState>({ hidden: false, anchor: 0 })
  const [hidden, setHidden] = useState(false)
  const show = () => {
    chrome.current = { hidden: false, anchor: chrome.current.anchor }
    setHidden(false)
  }
  // Al cambiar de pantalla o de estructura, las barras vuelven a verse.
  useEffect(show, [pathname, layout])

  const header =
    layout === 'thumb' ? null : <AppHeader hideFrom={layout === 'library' ? 'lg' : layout === 'dock' ? 'never' : 'md'} />
  const bottom = layout === 'app' || focus ? <BottomNav /> : layout === 'thumb' ? <ThumbNav /> : layout === 'dock' ? <DockNav /> : null

  return (
    // data-domain fija el color de la temática para todo lo que hay dentro. El marco va fijo a
    // la pantalla (sin depender de 100vh/dvh): solo se desplaza <main>, así el rebote del móvil
    // no arrastra la barra de navegación ni deja huecos debajo.
    <div className="pt-safe px-safe fixed inset-0 flex overflow-hidden" data-domain={domain.id} data-layout={layout}>
      {layout === 'library' ? <RailNav /> : layout !== 'dock' && <SideNav />}
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !bottom && 'pb-[env(safe-area-inset-bottom)]')}>
        {focus ? (
          <Collapsible hidden={hidden} onFocus={show}>
            {header}
          </Collapsible>
        ) : (
          header
        )}
        {layout === 'library' && <TopTabs />}
        <main
          onScroll={
            focus
              ? (e) => {
                  const next = nextChrome(chrome.current, e.currentTarget.scrollTop)
                  chrome.current = next
                  if (next.hidden !== hidden) setHidden(next.hidden)
                }
              : undefined
          }
          className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain"
        >
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
        {focus ? (
          <Collapsible hidden={hidden} onFocus={show}>
            {bottom}
          </Collapsible>
        ) : (
          bottom
        )}
      </div>
    </div>
  )
}
