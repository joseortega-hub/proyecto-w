import { useNavigate, useSearchParams } from 'react-router'
import { Icon, Spinner } from '@/components/atoms'
import { PulseNote } from '@/components/molecules'
import { ArtistPicker, VersusArena } from '@/components/organisms'
import { usePerreoArtists } from '@/lib/perreo'
import { useCompare, useHot } from '@/lib/perreo-pulse'
import { NO_FILTERS } from '@/lib/perreo-types'

/** «1 vs 1»: elige de 2 a 4 artistas y enfréntalos con sus números. La selección va en la URL (se puede compartir). */
export function PerreoVersusPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const selected = (params.get('vs') ?? '').split(',').filter(Boolean).slice(0, 4)
  const setSelected = (slugs: string[]) => setParams(slugs.length ? { vs: slugs.join(',') } : {}, { replace: true })
  const all = usePerreoArtists(NO_FILTERS)
  const hot = useHot('week')
  const compare = useCompare(selected)
  const suggestion = hot.data?.entries.slice(0, 2).map((e) => e.slug)
  const share = async () => {
    const names = compare.data?.artists.map((a) => a.name).join(' vs ')
    try {
      await navigator.share?.({ title: `${names} · Cara a cara`, url: window.location.href })
    } catch {
      /* compartir cancelado */
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 md:px-10 md:py-8">
      <header className="flex flex-col gap-1">
        <span className="perreo-sticker self-start">1 vs 1</span>
        <h1 className="font-poster perreo-neon text-6xl text-white">Cara a cara</h1>
        <p className="text-white/70">Sube de 2 a 4 artistas al ring y que hablen los números.</p>
      </header>
      <ArtistPicker artists={all.data?.artists ?? []} selected={selected} onChange={setSelected} />
      {selected.length < 2 && suggestion?.length === 2 && (
        <button type="button" onClick={() => setSelected(suggestion)} className="font-poster flex min-h-12 items-center justify-center gap-2 self-start rounded-full bg-[var(--artist)] px-5 text-xl text-black shadow-[3px_3px_0_#000]">
          <Icon name="flame" className="size-5" /> Duelo de la semana
        </button>
      )}
      {selected.length >= 2 &&
        (compare.isPending ? (
          <Spinner label="Preparando el ring…" />
        ) : compare.data ? (
          <>
            <VersusArena data={compare.data} onOpenArtist={(s) => navigate(`/perreo/artistas/${s}`)} />
            {typeof navigator.share === 'function' && (
              <button type="button" onClick={() => void share()} className="flex min-h-11 items-center gap-2 self-start rounded-full border border-white/20 px-4 text-sm font-bold text-white">
                <Icon name="share" className="size-4" /> Compartir el duelo
              </button>
            )}
          </>
        ) : (
          <p className="text-white/70">No he podido cargar el duelo. Prueba otra vez en un momento.</p>
        ))}
      <PulseNote updated={compare.data?.updated} />
    </div>
  )
}
