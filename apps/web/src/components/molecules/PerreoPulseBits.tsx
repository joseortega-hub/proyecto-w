import { useState, type CSSProperties } from 'react'
import { Icon } from '@/components/atoms'
import { photoUrl } from '@/lib/perreo-edit'
import { DATA_NOTE, releaseWhen, type HotEntry, type PerreoRelease, type PulseArtist } from '@/lib/perreo-pulse'
import { cn } from '@/lib/utils'
import '@/styles/perreo.css'

/** Foto redonda de un artista con su color de borde; iniciales si no hay foto. */
export function ArtistAvatar({ artist, size = 48, className }: { artist: Pick<PulseArtist, 'slug' | 'name' | 'photoV' | 'color'>; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <span
      className={cn('grid flex-none place-items-center overflow-hidden rounded-full border-2 bg-black/40 font-poster text-white', className)}
      style={{ width: size, height: size, borderColor: artist.color ?? 'var(--artist)', fontSize: size * 0.42 }}
    >
      {artist.photoV && !failed ? <img src={photoUrl(artist)} alt="" loading="lazy" onError={() => setFailed(true)} className="size-full object-cover object-top" /> : artist.name.slice(0, 2).toUpperCase()}
    </span>
  )
}

/** Pestañas de cartel (semana, mes, año…): la activa es una pegatina ladeada. */
export function PerreoTabs<T extends string>({ value, options, onChange, label, className }: { value: T; options: { value: T; label: string; badge?: number }[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'font-poster inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-lg tracking-wide transition-transform focus-visible:outline-2 focus-visible:outline-[var(--artist)]',
              on ? 'perreo-sticker min-h-11 text-lg' : 'border border-white/15 text-white/75 hover:border-white/40',
            )}
          >
            {o.label}
            {o.badge != null && <span className={cn('rounded-full px-1.5 font-sans text-xs font-bold', on ? 'bg-black/20' : 'bg-white/10')}>{o.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Un lanzamiento: portada, título, artista y cuándo sale; «lo próximo» lleva sello de cuenta atrás. */
export function ReleaseCard({ release, upcoming, onOpenArtist, now }: { release: PerreoRelease; upcoming?: boolean; onOpenArtist?: (slug: string) => void; now?: Date }) {
  const accent = release.artist.color ?? 'var(--artist)'
  const kind = release.recordType === 'ep' ? 'EP' : release.kind === 'album' ? 'Disco' : 'Canción'
  return (
    <article className="group relative flex min-w-0 gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5" style={{ '--artist': accent } as CSSProperties}>
      <div className="relative size-20 flex-none overflow-hidden rounded-lg bg-black/40">
        {release.coverUrl ? (
          <img src={release.coverUrl} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center bg-[radial-gradient(circle,var(--artist),#000_75%)] font-poster text-3xl text-white">{kind[0]}</span>
        )}
        {upcoming && <span className="perreo-sticker absolute -bottom-1 -left-1 px-1.5 text-sm">PRONTO</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <span className="text-xs font-bold tracking-wide text-[var(--artist)] uppercase">
          {kind} · {releaseWhen(release.releaseDate, now)}
        </span>
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold break-words text-white">{release.title}</h3>
        <button type="button" onClick={() => onOpenArtist?.(release.artist.slug)} className="flex min-h-8 min-w-0 items-center gap-1.5 self-start text-left text-sm text-white/70 hover:text-white">
          <ArtistAvatar artist={release.artist} size={22} className="border" />
          <span className="truncate">{release.artist.name}</span>
        </button>
      </div>
      {release.link && (
        <a href={release.link} target="_blank" rel="noreferrer" aria-label={`Abrir «${release.title}» en ${release.source === 'deezer' ? 'Deezer' : 'MusicBrainz'}`} className="grid size-11 flex-none place-items-center self-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
          <Icon name="external" className="size-5" />
        </a>
      )}
    </article>
  )
}

/** Puesto del ranking de «Fuego»: número de cartel, foto, motivos y termómetro. */
export function HotRow({ entry, position, maxScore, onOpen }: { entry: HotEntry; position: number; maxScore: number; onOpen?: (slug: string) => void }) {
  const accent = entry.artist.color ?? 'var(--artist)'
  const heat = maxScore > 0 ? Math.max(0.06, entry.score / maxScore) : 0
  return (
    <button
      type="button"
      onClick={() => onOpen?.(entry.slug)}
      style={{ '--artist': accent } as CSSProperties}
      className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-left hover:border-[var(--artist)] focus-visible:outline-2 focus-visible:outline-[var(--artist)]"
    >
      <span className={cn('font-poster w-10 flex-none text-center leading-none', position <= 3 ? 'perreo-neon text-5xl text-[var(--artist)]' : 'perreo-outline text-4xl')}>{position}</span>
      <ArtistAvatar artist={entry.artist} size={52} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[16px] font-bold text-white">{entry.artist.name}</span>
        <span className="flex flex-wrap gap-1">
          {entry.reasons.map((r) => (
            <span key={r} className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">
              {r}
            </span>
          ))}
        </span>
        <span aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <span className="block h-full rounded-full bg-[linear-gradient(90deg,#ffb020,var(--artist))]" style={{ width: `${heat * 100}%` }} />
        </span>
      </span>
      {position === 1 && <span aria-label="El más caliente" className="text-2xl">🔥</span>}
    </button>
  )
}

/** Nota honesta sobre de dónde salen las cifras (y por qué no hay oyentes de Spotify). */
export function PulseNote({ updated, className }: { updated?: string | null; className?: string }) {
  return (
    <details className={cn('rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70', className)}>
      <summary className="flex min-h-8 cursor-pointer items-center gap-2 font-bold text-white/85">
        <Icon name="info" className="size-4" /> ¿De dónde salen estos números?
        {updated && <span className="ml-auto font-normal text-white/50">al {updated.split('-').reverse().join('/')}</span>}
      </summary>
      <p className="mt-2">{DATA_NOTE}</p>
    </details>
  )
}

/** Sin datos del pulso todavía (no se ha lanzado `pnpm perreo:pulse`). */
export function PulseEmpty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 p-6 text-center text-white/70">
      <span className="perreo-eq flex h-8 items-end gap-1" aria-hidden>
        {[0.4, 0.9, 0.6, 1, 0.5].map((h, i) => (
          <span key={i} style={{ height: `${h * 100}%`, animationDelay: `${i * 0.1}s` }} />
        ))}
      </span>
      <p>{text}</p>
    </div>
  )
}

