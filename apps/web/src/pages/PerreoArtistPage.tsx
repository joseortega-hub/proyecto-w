import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Button, Spinner } from '@/components/atoms'
import { ArtistEditForm, ArtistProfile } from '@/components/organisms'
import { photoUrl, useEditArtist, usePerreoArtist } from '@/lib/perreo'
import { usePlayer } from '@/player/player-context'

/** Ficha de un artista con su primera lista y «Hazme una lista con este artista». */
export function PerreoArtistPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const player = usePlayer()
  const detail = usePerreoArtist(slug)
  const editArtist = useEditArtist(slug ?? '')
  const [editing, setEditing] = useState(false)
  if (detail.isPending) return <Spinner label="Abriendo la ficha…" />
  if (detail.isError || !detail.data) return <Navigate to="/perreo/artistas" replace />
  const { artist, similar, firstList, ownSongs } = detail.data
  const listId = `perreo-${artist.slug}`

  const play = (index: number) => {
    if (player.listId === listId && player.index === index) return player.toggle()
    const entries = firstList.map((item) => ({ item, reason: `Para ${artist.name} y los suyos`, match: 0.9 }))
    player.playList(entries, { title: `${artist.name} y los suyos`, id: listId, domainId: 'perreo', start: index })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-5 md:px-10 md:py-8">
      <Button variant="ghost" size="md" className="self-start" onClick={() => navigate('/perreo/artistas')}>
        ← Artistas
      </Button>
      <ArtistProfile
        artist={artist}
        similar={similar}
        firstList={firstList}
        photoUrl={photoUrl(artist)}
        activeItemId={player.listId === listId ? player.current?.item.id : null}
        playing={player.playing}
        onPlay={play}
        onMakeList={() => navigate('/perreo/entrevista', { state: { initialText: `canciones de ${artist.name} y parecidos`, preferences: {} } })}
        onOpenArtist={(s) => navigate(`/perreo/artistas/${s}`)}
        onEdit={() => (editArtist.reset(), setEditing(true))}
      />
      <ArtistEditForm
        open={editing}
        artist={artist}
        ownSongs={ownSongs}
        photoUrl={photoUrl(artist)}
        saving={editArtist.isPending}
        error={editArtist.error?.message ?? null}
        onSave={(patch) => editArtist.mutate(patch, { onSuccess: () => setEditing(false) })}
        onClose={() => setEditing(false)}
      />
    </div>
  )
}
