import { useState } from 'react'
import { Button, Chip, SearchField, Text } from '@/components/atoms'
import { ArtistCard, BottomSheet, FameSlider } from '@/components/molecules'
import { activeFilterCount, KIND_LABELS, kindCounter, NO_FILTERS, type PerreoArtist, type PerreoArtistList, type PerreoFilters, type PerreoSort } from '@/lib/perreo-types'
import { flagOf } from '@/lib/perreo-format'
import { cn } from '@/lib/utils'

const SORTS: { id: PerreoSort; label: string }[] = [
  { id: 'fame', label: 'Fama' },
  { id: 'age', label: 'Antigüedad' },
  { id: 'name', label: 'Nombre' },
]

interface ArtistExplorerProps {
  filters: PerreoFilters
  onChange: (filters: PerreoFilters) => void
  data?: PerreoArtistList
  loading?: boolean
  photoUrl: (artist: PerreoArtist) => string
  onOpen: (slug: string) => void
  className?: string
}

/** Un grupo de chips de un solo valor: pulsar el activo lo quita. */
function ChipGroup({ label, options, value, onSelect }: { label: string; options: { value: string; label?: string; count: number; prefix?: string }[]; value: string; onSelect: (v: string) => void }) {
  if (!options.length) return null
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="label-caps">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? '' : o.value)}
              className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Chip variant={active ? 'solid' : 'outline'} className={cn('cursor-pointer', active && 'bg-domain text-card')}>
                {o.prefix ? `${o.prefix} ` : ''}
                {o.label ?? o.value} <span className="font-normal opacity-70">{o.count}</span>
              </Chip>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Explorador de artistas: filtros combinables (fama, país, ciudad, época, sello y estilo), orden y galería. */
export function ArtistExplorer({ filters, onChange, data, loading, photoUrl, onOpen, className }: ArtistExplorerProps) {
  const [sheet, setSheet] = useState(false)
  const set = <K extends keyof PerreoFilters>(key: K, value: PerreoFilters[K]) => onChange({ ...filters, [key]: value })
  const active = activeFilterCount(filters)
  const facets = data?.facets
  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <SearchField label="Buscar artista" value={filters.q} onChange={(e) => set('q', e.target.value)} />

      <div role="group" aria-label="Ordenar por" className="flex flex-wrap items-center gap-2">
        <span className="label-caps">Ordenar</span>
        {SORTS.map((s) => (
          <button key={s.id} type="button" aria-pressed={filters.sort === s.id} onClick={() => set('sort', s.id)} className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-ring">
            <Chip variant={filters.sort === s.id ? 'solid' : 'outline'} className={cn('cursor-pointer', filters.sort === s.id && 'bg-domain text-card')}>
              {s.label}
            </Chip>
          </button>
        ))}
      </div>

      <FameSlider min={filters.fameMin} max={filters.fameMax} onChange={({ min, max }) => onChange({ ...filters, fameMin: min, fameMax: max })} />

      {facets && (
        <>
          <Button variant="secondary" size="md" onClick={() => setSheet(true)} className="self-start">
            Filtros{active > 0 && <span className="rounded-full bg-domain px-2 text-sm text-card">{active}</span>}
          </Button>
          <BottomSheet
            open={sheet}
            onClose={() => setSheet(false)}
            title="Filtros"
            footer={
              <>
                <Button variant="secondary" size="md" className="flex-1" disabled={active === 0} onClick={() => onChange({ ...NO_FILTERS, sort: filters.sort })}>
                  Limpiar
                </Button>
                <Button size="md" className="flex-1" onClick={() => setSheet(false)}>
                  Ver {data?.artists.length ?? ""}
                </Button>
              </>
            }
          >
            <div className="flex flex-col gap-4">
              <ChipGroup label="Tipo" value={filters.kind} onSelect={(v) => set('kind', v)} options={facets.kinds.map((k) => ({ value: k.value, label: KIND_LABELS[k.value] ?? k.value, count: k.count }))} />
              <ChipGroup label="País" value={filters.country} onSelect={(v) => set('country', v)} options={facets.countries.map((c) => ({ ...c, prefix: flagOf(c.value) }))} />
              <ChipGroup label="Ciudad" value={filters.city} onSelect={(v) => set('city', v)} options={facets.cities} />
              <ChipGroup label="Época" value={filters.era} onSelect={(v) => set('era', v)} options={facets.eras.map((e) => ({ value: e.value, label: e.label, count: e.count }))} />
              <ChipGroup label="Estilo" value={filters.style} onSelect={(v) => set('style', v)} options={facets.styles} />
              <ChipGroup label="Sello" value={filters.label} onSelect={(v) => set('label', v)} options={facets.labels.slice(0, 14)} />
            </div>
          </BottomSheet>
        </>
      )}

      {facets && facets.kinds.length > 1 && (
        <Text tone="muted" size="sm">
          {kindCounter(facets.kinds)}
        </Text>
      )}

      <div className="flex items-center justify-between">
        <Text tone="muted" size="sm" aria-live="polite">
          {data ? (data.artists.length === data.total ? `${data.total} artistas` : `${data.artists.length} de ${data.total} artistas`) : 'Cargando artistas…'}
        </Text>
        {(active > 0 || filters.sort !== 'fame') && (
          <Button variant="ghost" size="md" onClick={() => onChange(NO_FILTERS)}>
            Limpiar
          </Button>
        )}
      </div>

      {data && data.artists.length === 0 ? (
        <Text tone="muted" className="py-8 text-center">
          Ningún artista cumple todo a la vez. Quita algún filtro, bro.
        </Text>
      ) : (
        <ul className={cn('grid grid-cols-2 gap-3 max-[340px]:grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5', loading && 'opacity-60')}>
          {(data?.artists ?? []).map((a) => (
            <li key={a.slug}>
              <ArtistCard name={a.name} photoUrl={photoUrl(a)} country={a.country} debutYear={a.debutYear} fame={a.fame} styles={a.styles} kind={a.kind} incomplete={a.incomplete} onOpen={() => onOpen(a.slug)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
