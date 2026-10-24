import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { Spinner } from '@/components/atoms'
import { UnlockBurst } from '@/components/molecules'
import { TributeCover } from '@/components/organisms'
import { photoUrl, usePerreoArtist, usePerreoUnlock } from '@/lib/perreo'
import { usePlayer } from '@/player/player-context'

/** Homenaje a un artista del Modo Perreo: animación de desbloqueo (solo la primera vez), portada y primera lista. */
export function PerreoTributePage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const unlock = usePerreoUnlock()
  const detail = usePerreoArtist(slug)
  const player = usePlayer()
  const [bursting, setBursting] = useState(Boolean((location.state as { fresh?: boolean } | null)?.fresh))

  if (!unlock) return <Navigate to="/" replace />
  if (detail.isPending) return <Spinner label="Preparando el homenaje…" />
  if (detail.isError || !detail.data) return <Navigate to="/perreo/artistas" replace />

  const { artist, firstList } = detail.data
  const nickname = unlock.slug === artist.slug ? unlock.nickname : undefined
  const play = () => {
    const entries = firstList.map((item) => ({ item, reason: `Para ${nickname ?? artist.name}, con flow`, match: 0.9 }))
    if (entries.length) player.playList(entries, { title: `Homenaje a ${nickname ?? artist.name}`, id: `perreo-${artist.slug}`, domainId: 'perreo' })
  }

  return (
    <>
      {bursting && <UnlockBurst onDone={() => setBursting(false)} />}
      <TributeCover
        artistName={artist.name}
        nickname={nickname}
        photoUrl={photoUrl(artist.slug)}
        bio={artist.bio}
        songCount={firstList.length}
        onPlay={play}
        onMakeList={() => navigate('/perreo/entrevista', { state: { initialText: `canciones de ${artist.name} y parecidos`, preferences: {} } })}
        onExplore={() => navigate(`/perreo/artistas/${artist.slug}`)}
      />
    </>
  )
}
