import { Button, Chip, SearchField, Switch, Text } from '@/components/atoms'
import { ArtistCard, FameSlider } from '@/components/molecules'
import { activeFilterCount, NO_FILTERS, type PerreoArtistList, type PerreoFilters, type PerreoSort } from '@/lib/perreo-types'
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
  photoUrl: (slug: string) => string
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

      {data && data.followedTotal > 0 && (
        <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border-[1.5px] border-border bg-card px-3">
          <span className="font-bold">
            Solo los que sigo <span className="font-normal text-muted-foreground">{data.followedTotal} en Instagram</span>
          </span>
          <Switch label="Solo los que sigo en Instagram" checked={filters.followed} onCheckedChange={(v) => set('followed', v)} />
        </label>
      )}

      <FameSlider min={filters.fameMin} max={filters.fameMax} onChange={({ min, max }) => onChange({ ...filters, fameMin: min, fameMax: max })} />

      {facets && (
        <details className="group rounded-lg border-[1.5px] border-border bg-card p-3">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between font-bold">
            Filtros {active > 0 && <span className="text-sm font-normal text-muted-foreground">{active} activos</span>}
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            <ChipGroup label="País" value={filters.country} onSelect={(v) => set('country', v)} options={facets.countries.map((c) => ({ ...c, prefix: flagOf(c.value) }))} />
            <ChipGroup label="Ciudad" value={filters.city} onSelect={(v) => set('city', v)} options={facets.cities} />
            <ChipGroup label="Época" value={filters.era} onSelect={(v) => set('era', v)} options={facets.eras.map((e) => ({ value: e.value, label: e.label, count: e.count }))} />
            <ChipGroup label="Estilo" value={filters.style} onSelect={(v) => set('style', v)} options={facets.styles} />
            <ChipGroup label="Sello" value={filters.label} onSelect={(v) => set('label', v)} options={facets.labels.slice(0, 14)} />
          </div>
        </details>
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
        <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5', loading && 'opacity-60')}>
          {(data?.artists ?? []).map((a) => (
            <li key={a.slug}>
              <ArtistCard name={a.name} photoUrl={photoUrl(a.slug)} country={a.country} debutYear={a.debutYear} fame={a.fame} styles={a.styles} followed={a.followed} onOpen={() => onOpen(a.slug)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
