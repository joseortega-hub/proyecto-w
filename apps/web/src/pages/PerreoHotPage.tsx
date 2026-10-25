import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Spinner } from '@/components/atoms'
import { HotRow, PerreoTabs, PulseEmpty, PulseNote } from '@/components/molecules'
import { flagOf } from '@/lib/perreo-format'
import { PERIOD_LABELS, useHot, type PulsePeriod } from '@/lib/perreo-pulse'

/** «Fuego»: los artistas más calientes del momento, en todo el mundo o en un país. */
export function PerreoHotPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<PulsePeriod>('week')
  const [country, setCountry] = useState('')
  const q = useHot(period, country)
  const entries = q.data?.entries ?? []
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 md:px-10 md:py-8">
      <header className="flex flex-col gap-1">
        <span className="perreo-sticker self-start">🔥 Fuego</span>
        <h1 className="font-poster perreo-neon text-6xl text-white">Lo más caliente</h1>
        <p className="text-white/70">Mezcla sus lanzamientos del momento, cuánto crece su público y su fama; por país, también el top de Last.fm de allí.</p>
      </header>
      <PerreoTabs label="Momento" value={period} onChange={setPeriod} options={(['week', 'month', 'year'] as const).map((p) => ({ value: p, label: PERIOD_LABELS[p] }))} />
      <label className="flex flex-col gap-1 text-sm font-bold text-white/85">
        País
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="min-h-11 rounded-full border border-white/15 bg-black/50 px-4 text-base font-normal text-white">
          <option value="">🌎 Todo el mundo</option>
          {(q.data?.countries ?? []).map((c) => (
            <option key={c.value} value={c.value}>
              {flagOf(c.value)} {c.value}
            </option>
          ))}
        </select>
      </label>
      {q.isPending ? (
        <Spinner label="Midiendo la temperatura…" />
      ) : entries.length ? (
        <ol className="flex flex-col gap-2">
          {entries.map((e, i) => (
            <li key={e.slug}>
              <HotRow entry={e} position={i + 1} maxScore={entries[0].score} onOpen={(s) => navigate(`/perreo/artistas/${s}`)} />
            </li>
          ))}
        </ol>
      ) : (
        <PulseEmpty text="Nadie de aquí en este momento. Prueba otro país o un periodo más largo." />
      )}
      {!q.data?.updated && !q.isPending && <PulseEmpty text="Sin el pulso cargado, el ranking sale solo por fama. Se precalcula con pnpm perreo:pulse." />}
      <PulseNote updated={q.data?.updated} />
    </div>
  )
}
