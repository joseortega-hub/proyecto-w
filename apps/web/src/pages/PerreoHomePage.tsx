import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon, type IconName } from '@/components/atoms'
import { ArtistAvatar, HotRow, ReleaseCard } from '@/components/molecules'
import { photoUrl, usePerreoArtist, usePerreoArtists, usePerreoUnlock } from '@/lib/perreo'
import { artistOfTheDay, useHot, useReleases } from '@/lib/perreo-pulse'
import { NO_FILTERS } from '@/lib/perreo-types'
import '@/styles/perreo.css'

const TILES: { to: string; title: string; text: string; icon: IconName }[] = [
  { to: '/perreo/cara-a-cara', title: '1 vs 1', text: 'Enfrenta a tus artistas con sus números', icon: 'activity' },
  { to: '/perreo/caliente', title: 'Fuego', text: 'Quién está más caliente, por país', icon: 'flame' },
  { to: '/perreo/novedades', title: 'Lo nuevo', text: 'Discos y canciones, y lo que viene', icon: 'sparkles' },
  { to: '/perreo/listas', title: 'Mis listas', text: 'Lo que ya te has guardado', icon: 'lists' },
]

/** «El Bloque»: la portada del Modo Perreo. */
export function PerreoHomePage() {
  const navigate = useNavigate()
  const unlock = usePerreoUnlock()
  const mine = usePerreoArtist(unlock?.slug)
  const all = usePerreoArtists(NO_FILTERS)
  const hot = useHot('week')
  const fresh = useReleases('month', '')
  const daily = artistOfTheDay(all.data?.artists ?? [])
  const name = unlock?.nickname || mine.data?.artist.name

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-7 px-4 py-4 md:px-10 md:py-8">
      <section className="relative flex flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-5">
        {mine.data && <img src={photoUrl(mine.data.artist)} alt="" aria-hidden className="absolute -top-6 -right-10 size-56 rotate-6 rounded-full object-cover object-top opacity-35 blur-[1px] md:size-72" />}
        <span className="perreo-sticker relative self-start">Tu bloque</span>
        <h1 className="font-poster perreo-neon relative text-[clamp(2.8rem,12vw,5.5rem)] text-white">
          Qué hay,
          <br />
          <span className="text-[var(--artist)]">{name ?? 'mi gente'}</span>
        </h1>
        <p className="relative max-w-md text-white/75">Aquí manda el perreo: lo nuevo, lo que está que arde y tus artistas cara a cara.</p>
        <div className="relative flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={() => navigate('/perreo/entrevista')} className="font-poster flex min-h-12 items-center gap-2 rounded-full bg-[var(--artist)] px-5 text-xl text-black shadow-[3px_3px_0_#000]">
            <Icon name="sparkles" className="size-5" /> Hazme una lista
          </button>
          <Link to="/perreo/artistas" className="font-poster flex min-h-12 items-center gap-2 rounded-full border border-white/25 px-5 text-xl text-white">
            <Icon name="users" className="size-5" /> La Calle
          </Link>
        </div>
      </section>

      {daily && (
        <Link to={`/perreo/artistas/${daily.slug}`} style={{ '--artist': daily.color ?? 'var(--artist)' } as CSSProperties} className="flex items-center gap-4 rounded-2xl border border-[var(--artist)]/50 bg-[linear-gradient(110deg,color-mix(in_oklab,var(--artist)_25%,transparent),transparent_70%)] p-3">
          <ArtistAvatar artist={{ ...daily, photoV: daily.photoV ?? null, color: daily.color ?? null }} size={68} className="border-[3px]" />
          <span className="flex min-w-0 flex-col">
            <span className="text-xs font-bold tracking-[0.2em] text-[var(--artist)] uppercase">Artista del día</span>
            <span className="font-poster truncate text-3xl text-white">{daily.name}</span>
            <span className="truncate text-sm text-white/65">{[daily.countries[0], daily.styles.slice(0, 2).join(' · ')].filter(Boolean).join(' — ')}</span>
          </span>
          <Icon name="next" className="ml-auto size-5 flex-none text-white/60" />
        </Link>
      )}

      {!!hot.data?.entries.length && (
        <section className="flex flex-col gap-3" aria-labelledby="fuego">
          <div className="flex items-baseline justify-between">
            <h2 id="fuego" className="font-poster text-4xl text-white">
              🔥 Fuego esta semana
            </h2>
            <Link to="/perreo/caliente" className="text-sm font-bold text-[var(--artist)]">
              Ver todo
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {hot.data.entries.slice(0, 3).map((e, i) => (
              <HotRow key={e.slug} entry={e} position={i + 1} maxScore={hot.data.entries[0].score} onOpen={(s) => navigate(`/perreo/artistas/${s}`)} />
            ))}
          </div>
        </section>
      )}

      {!!fresh.data?.releases.length && (
        <section className="flex flex-col gap-3" aria-labelledby="nuevo">
          <div className="flex items-baseline justify-between">
            <h2 id="nuevo" className="font-poster text-4xl text-white">
              Lo nuevo
            </h2>
            <Link to="/perreo/novedades" className="text-sm font-bold text-[var(--artist)]">
              Ver todo
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {fresh.data.releases.slice(0, 4).map((r) => (
              <ReleaseCard key={r.id} release={r} onOpenArtist={(s) => navigate(`/perreo/artistas/${s}`)} />
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4" aria-label="Secciones">
        {TILES.map((t, i) => (
          <Link key={t.to} to={t.to} className="flex min-h-28 flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-3 hover:border-[var(--artist)]" style={{ transform: `rotate(${i % 2 ? 0.8 : -0.8}deg)` }}>
            <Icon name={t.icon} className="size-6 text-[var(--artist)]" />
            <span className="font-poster text-2xl text-white">{t.title}</span>
            <span className="text-xs text-white/65">{t.text}</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
