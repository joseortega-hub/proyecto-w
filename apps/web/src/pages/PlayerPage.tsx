import { useNavigate } from 'react-router'
import { Button } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { FullPlayer } from '@/components/organisms'
import { FocusTemplate } from '@/components/templates/FocusTemplate'
import { usePlayer } from '@/player/player-context'

export function PlayerPage() {
  const navigate = useNavigate()
  const player = usePlayer()
  const close = () => (window.history.length > 1 ? navigate(-1) : navigate(player.listId && player.domainId ? `/${player.domainId}/resultado/${player.listId}` : '/'))

  if (!player.current) {
    return (
      <FocusTemplate className="justify-center">
        <EmptyState icon="play" title="No suena nada todavía" description="Haz una entrevista y te preparamos una lista." action={<Button onClick={() => navigate('/')}>Empezar</Button>} />
      </FocusTemplate>
    )
  }

  return (
    <FocusTemplate className="px-6">
      <FullPlayer
        entry={player.current}
        listTitle={player.listTitle}
        playing={player.playing}
        position={player.position}
        duration={player.duration}
        hasPrevious={player.hasPrevious}
        hasNext={player.hasNext}
        shuffle={player.order !== null}
        repeat={player.repeat}
        onShuffle={player.toggleShuffle}
        onRepeat={player.cycleRepeat}
        onClose={close}
        onToggle={player.toggle}
        onPrevious={player.previous}
        onNext={player.next}
        onSeek={player.seek}
        videoSlot={player.video ? player.setVideoSlot : undefined}
      />
    </FocusTemplate>
  )
}
