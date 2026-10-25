import { useMemo, useState, type CSSProperties } from 'react'
import { Icon } from '@/components/atoms'
import { ArtistAvatar } from '@/components/molecules'
import type { PerreoArtist } from '@/lib/perreo-types'
import { cn } from '@/lib/utils'

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

interface ArtistPickerProps {
  artists: PerreoArtist[]
  selected: string[]
  onChange: (slugs: string[]) => void
  max?: number
  className?: string
}

/** Elegir de 2 a `max` artistas para el cara a cara: buscador (también por apodo y alias) y esquinas del ring. */
export function ArtistPicker({ artists, selected, onChange, max = 4, className }: ArtistPickerProps) {
  const [q, setQ] = useState('')
  const bySlug = useMemo(() => new Map(artists.map((a) => [a.slug, a])), [artists])
  const results = useMemo(() => {
    const f = fold(q.trim())
    const pool = artists.filter((a) => !selected.includes(a.slug) && (a.kind === 'artist' || a.kind === 'group'))
    return (f ? pool.filter((a) => [a.name, a.nickname ?? '', ...(a.aliases ?? [])].some((n) => fold(n).includes(f))) : pool).slice(0, f ? 12 : 8)
  }, [artists, selected, q])
  const full = selected.length >= max
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap gap-2" aria-label="En el ring">
        {Array.from({ length: Math.max(2, Math.min(max, selected.length + (full ? 0 : 1))) }, (_, i) => {
          const a = bySlug.get(selected[i] ?? '')
          return a ? (
            <button
              key={a.slug}
              type="button"
              onClick={() => onChange(selected.filter((s) => s !== a.slug))}
              aria-label={`Sacar a ${a.name} del ring`}
              style={{ '--artist': a.color ?? '#ff4fd0' } as CSSProperties}
              className="flex min-h-12 items-center gap-2 rounded-full border-2 border-[var(--artist)] bg-black/40 py-1 pr-3 pl-1 text-sm font-bold text-white"
            >
              <ArtistAvatar artist={{ ...a, photoV: a.photoV ?? null, color: a.color ?? null }} size={36} />
              {a.name}
              <Icon name="close" className="size-4 opacity-70" />
            </button>
          ) : (
            <span key={`hueco-${i}`} className="font-poster flex min-h-12 items-center rounded-full border-2 border-dashed border-white/20 px-4 text-lg text-white/40">
              Esquina {i + 1}
            </span>
          )
        })}
      </div>
      {!full && (
        <>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca un artista, apodo o alias"
            aria-label="Buscar artista para el cara a cara"
            className="min-h-11 w-full rounded-full border border-white/15 bg-black/40 px-4 text-base text-white outline-none placeholder:text-white/40 focus:border-[var(--artist)]"
          />
          <div className="flex flex-wrap gap-2">
            {results.map((a) => (
              <button
                key={a.slug}
                type="button"
                onClick={() => (onChange([...selected, a.slug]), setQ(''))}
                className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pr-3 pl-1 text-sm text-white/85 hover:border-white/40"
              >
                <ArtistAvatar artist={{ ...a, photoV: a.photoV ?? null, color: a.color ?? null }} size={30} className="border" />
                {a.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
