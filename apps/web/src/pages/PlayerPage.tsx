import { useNavigate } from 'react-router'
import { Button } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { FullPlayer } from '@/components/organisms'
import { FocusTemplate } from '@/components/templates/FocusTemplate'
import { toast } from 'sonner'
import type { QueueEntry } from '@/player/player-context'
import { usePlayer } from '@/player/player-context'
import { hasSeen, seenMap, seenWords, useSeen, useSeenMutation } from '@/lib/seen'
import { useFeedback, useTaste } from '@/lib/taste'

const neighbor = (queue: QueueEntry[], index: number) => {
  const { item } = queue[index]
  return { index, title: item.title, subtitle: item.subtitle, imageUrl: item.imageUrl }
}

export function PlayerPage() {
  const navigate = useNavigate()
  const player = usePlayer()
  // 👍/👎 y «Ya la escuché» de lo que suena, con el mismo perfil de gustos que el resultado.
  const domainId = player.domainId ?? ''
  const taste = useTaste(domainId)
  const feedback = useFeedback(domainId)
  const seenList = useSeen(domainId)
  const seenMutation = useSeenMutation(domainId)
  const onError = (e: Error) => toast.error('No he podido guardarlo', { description: e.message })
  const close = () => (window.history.length > 1 ? navigate(-1) : navigate(player.listId && player.domainId ? `/${player.domainId}/resultado/${player.listId}` : '/'))

  if (!player.current) {
    return (
      <FocusTemplate className="justify-center">
        <EmptyState icon="play" title="No suena nada todavía" description="Haz una entrevista y te preparamos una lista." action={<Button onClick={() => navigate('/')}>Empezar</Button>} />
      </FocusTemplate>
    )
  }

  const { item } = player.current
  const seen = seenMap(seenList.data)
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
        onStop={() => {
          player.stop()
          close()
        }}
        onToggle={player.toggle}
        onPrevious={player.previous}
        onNext={player.next}
        onSeek={player.seek}
        videoSlot={player.video ? player.setVideoSlot : undefined}
        upNext={player.upcoming.map((index) => neighbor(player.queue, index))}
        previousEntry={player.previousTrack === null ? null : neighbor(player.queue, player.previousTrack)}
        onJump={player.jumpTo}
        feedback={
          domainId
            ? { value: taste.data?.feedback[item.id] ?? null, onChange: (value) => feedback.mutate({ itemId: item.id, value }, { onError }) }
            : undefined
        }
        seen={
          hasSeen(domainId)
            ? {
                words: seenWords(domainId),
                rating: seen.has(item.id) ? seen.get(item.id) : undefined,
                onChange: (next) => seenMutation.mutate({ item, ...next }, { onError }),
              }
            : undefined
        }
      />
    </FocusTemplate>
  )
}
