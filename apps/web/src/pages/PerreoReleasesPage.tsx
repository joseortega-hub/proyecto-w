import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Spinner } from '@/components/atoms'
import { PerreoTabs, PulseEmpty, PulseNote, ReleaseCard } from '@/components/molecules'
import { PERIOD_HINTS, PERIOD_LABELS, useReleases, type ReleaseKind, type ReleasePeriod } from '@/lib/perreo-pulse'

const PERIODS: ReleasePeriod[] = ['week', 'month', 'year', 'upcoming']

/** «Lo Nuevo»: discos y canciones de los artistas del Modo Perreo, de esta semana, del mes, del año y lo que viene. */
export function PerreoReleasesPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<ReleasePeriod>('week')
  const [kind, setKind] = useState<ReleaseKind>('song')
  const q = useReleases(period, kind)
  const counts = q.data?.counts
  const list = q.data?.releases ?? []
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 md:px-10 md:py-8">
      <header className="flex flex-col gap-1">
        <span className="perreo-sticker self-start">Lo nuevo</span>
        <h1 className="font-poster perreo-neon text-6xl text-white">Recién salido</h1>
        <p className="text-white/70">Lanzamientos de los artistas del Modo Perreo, {PERIOD_HINTS[period]}.</p>
      </header>
      <PerreoTabs label="Tipo" value={kind} onChange={setKind} options={[{ value: 'song', label: 'Canciones', badge: counts?.[period].song }, { value: 'album', label: 'Discos y EP', badge: counts?.[period].album }]} />
      <PerreoTabs label="Momento" value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABELS[p], badge: counts?.[p][kind] }))} />
      {q.isPending ? (
        <Spinner label="Buscando lo último…" />
      ) : !q.data?.updated ? (
        <PulseEmpty text="Aún no hay novedades cargadas. Se precalculan con pnpm perreo:pulse." />
      ) : list.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((r) => (
            <ReleaseCard key={r.id} release={r} upcoming={period === 'upcoming'} onOpenArtist={(s) => navigate(`/perreo/artistas/${s}`)} />
          ))}
        </div>
      ) : (
        <PulseEmpty text={period === 'upcoming' ? 'Nadie ha anunciado fechas todavía. Atento, que esto se mueve.' : 'Nada nuevo en este momento. Prueba con un periodo más largo.'} />
      )}
      <PulseNote updated={q.data?.updated} />
    </div>
  )
}
