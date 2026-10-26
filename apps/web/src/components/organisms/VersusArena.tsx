import { useEffect, useState, type CSSProperties } from 'react'
import { ArtistAvatar, VersusHistory } from '@/components/molecules'
import { barWidth, COMPARE_GROUPS, countUp, metricNumber, type CompareMetricResult, type PerreoCompare, type PulseArtist, type VersusProfile } from '@/lib/perreo-pulse'
import { cn } from '@/lib/utils'
import '@/styles/perreo.css'

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Avance 0–1 durante `ms` desde que `active` pasa a true (para que los números suban como un marcador). */
function useProgress(active: boolean, ms: number) {
  const [t, setT] = useState(active && reducedMotion() ? 1 : 0)
  useEffect(() => {
    if (!active) return
    if (reducedMotion()) return setT(1)
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      setT(p)
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active, ms])
  return t
}

interface VersusArenaProps {
  data: PerreoCompare
  onOpenArtist?: (slug: string) => void
  className?: string
}

/**
 * Cara a cara: los artistas entran como en un combate (de los lados si son dos, cayendo si son más), sello «VS»
 * con destello y temblor, y luego cada métrica es una barra del color de cada artista que crece mientras su número
 * sube. Corona al que gana cada una y marcador final. Con `prefers-reduced-motion`, todo quieto y con el valor final.
 */
export function VersusArena({ data, onOpenArtist, className }: VersusArenaProps) {
  const [fight, setFight] = useState(reducedMotion())
  const key = data.artists.map((a) => a.slug).join(',')
  useEffect(() => {
    if (reducedMotion()) return setFight(true)
    setFight(false)
    const t = window.setTimeout(() => setFight(true), 1150)
    return () => window.clearTimeout(t)
  }, [key])
  const t = useProgress(fight, 1300)
  const { artists, result, values } = data
  const duo = artists.length === 2
  const champion = artists.find((a) => a.slug === result.champion)

  return (
    <section className={cn('flex flex-col gap-5', className)} aria-label="Cara a cara">
      {/* Entrada */}
      <div key={key} className="versus-hit relative isolate overflow-hidden rounded-2xl border border-white/10 bg-black/50 px-3 py-6">
        <span aria-hidden className="versus-flash absolute inset-0 -z-10 bg-white" />
        <div className={cn('grid items-center gap-2', duo ? 'grid-cols-[1fr_auto_1fr]' : 'grid-cols-2 gap-y-5 sm:grid-cols-4')}>
          {artists.map((a, i) => {
            const fighter = (
              <button
                key={a.slug}
                type="button"
                onClick={() => onOpenArtist?.(a.slug)}
                style={{ '--artist': a.color ?? '#ff4fd0', animationDelay: duo ? '0s' : `${i * 0.12}s` } as CSSProperties}
                className={cn('flex min-w-0 flex-col items-center gap-2 text-center', duo ? (i === 0 ? 'versus-left' : 'versus-right') : 'versus-drop')}
              >
                <ArtistAvatar artist={a} size={duo ? 104 : 84} className="border-4 shadow-[0_0_34px_var(--artist)]" />
                <span className="font-poster perreo-neon max-w-full text-2xl leading-none break-words text-white">{a.name}</span>
                <span className="font-poster text-4xl text-[var(--artist)] tabular-nums">{fight ? countUp(result.wins[a.slug] ?? 0, t) : 0}</span>
              </button>
            )
            return duo && i === 1 ? [<VsStamp key="vs" />, fighter] : fighter
          })}
        </div>
        {!duo && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <VsStamp />
          </div>
        )}
        <p className={cn('mt-5 text-center transition-opacity duration-500', fight && t >= 1 ? 'opacity-100' : 'opacity-0')} aria-live="polite">
          {champion ? (
            <span className="perreo-sticker text-2xl" style={{ '--artist': champion.color ?? '#ff4fd0' } as CSSProperties}>
              👑 Gana {champion.name}
            </span>
          ) : (
            <span className="perreo-sticker text-2xl">Empate técnico</span>
          )}
        </p>
      </div>

      {data.profiles && <FactSheet artists={artists} profiles={data.profiles} />}

      {/* Métricas, por bloques: audiencia (barras en escala logarítmica, para que sea justo), calle y carrera. */}
      {COMPARE_GROUPS.map((g) => {
        const metrics = result.metrics.filter((m) => (m.group ?? 'audience') === g.id)
        if (!metrics.length) return null
        return (
          <div key={g.id} className="flex flex-col gap-3">
            <h3 className="perreo-sticker self-start text-lg">{g.label}</h3>
            <ul className="flex flex-col gap-4">
              {metrics.map((m, mi) => (
                <MetricRow key={m.id} metric={m} artists={artists} values={values} fight={fight} t={t} delay={mi * 90} />
              ))}
            </ul>
            {g.id === 'audience' && metrics.some((m) => m.scale === 'log') && (
              <p className="text-xs text-white/50">Las barras de audiencia van en escala logarítmica: así se compara a una leyenda con alguien que empieza sin que su barra desaparezca. Las cifras son las reales.</p>
            )}
          </div>
        )
      })}

      <VersusHistory artists={artists} history={data.history} days={data.historyDays} />
    </section>
  )
}

function VsStamp() {
  return (
    <span aria-hidden className="versus-stamp font-poster grid size-16 place-items-center rounded-full bg-[#ffd400] text-4xl text-black shadow-[4px_4px_0_#000] sm:size-20 sm:text-5xl">
      VS
    </span>
  )
}

function MetricRow({ metric: m, artists, values, fight, t, delay }: { metric: CompareMetricResult; artists: PulseArtist[]; values: PerreoCompare['values']; fight: boolean; t: number; delay: number }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-poster text-xl tracking-wide text-white">{m.label}</h4>
        <span className="text-right text-xs text-white/50">{m.source}</span>
      </div>
      {artists.map((a) => {
        const bar = (m.bars ?? m.shares)[a.slug]
        const value = values[a.slug]?.[m.id] ?? null
        const wins = m.winners.includes(a.slug)
        // Las cifras con decimales (discos por año) suben de décima en décima.
        const shown = value == null ? null : Number.isInteger(value) ? countUp(value, t) : countUp(value * 10, t) / 10
        return (
          <div key={a.slug} className="grid grid-cols-[minmax(0,6.5rem)_1fr_auto] items-center gap-2" style={{ '--artist': a.color ?? '#ff4fd0' } as CSSProperties}>
            <span className="truncate text-sm text-white/80">{a.name}</span>
            <span className="h-4 overflow-hidden rounded-full bg-white/10">
              <span
                className={cn('versus-bar block h-full rounded-full bg-[var(--artist)]', wins && 'shadow-[0_0_14px_var(--artist)]')}
                style={{ width: `${fight ? barWidth(bar) * 100 : 0}%`, transitionDelay: `${delay}ms` }}
              />
            </span>
            <span className={cn('min-w-[4.5rem] text-right text-sm font-bold tabular-nums', wins ? 'text-[var(--artist)]' : 'text-white/80')}>
              {value == null ? 'sin dato' : metricNumber(fight ? shown : 0)}
              {wins && fight && t >= 1 && (
                <span className="versus-crown ml-1 inline-block" aria-label="gana">
                  👑
                </span>
              )}
            </span>
          </div>
        )
      })}
    </li>
  )
}

const STATUS: Record<string, string> = { active: 'En activo', hiatus: 'En pausa', retired: 'Retirado', deceased: 'Descansa en paz' }

/** La ficha cara a cara: lo que se sabe de cada uno sin número que comparar. */
function FactSheet({ artists, profiles }: { artists: PulseArtist[]; profiles: Record<string, VersusProfile> }) {
  const rows: { label: string; value: (p: VersusProfile) => string | null }[] = [
    { label: 'Debutó', value: (p) => (p.debutYear ? String(p.debutYear) : null) },
    { label: 'Estado', value: (p) => (p.status ? (STATUS[p.status] ?? p.status) : p.activeUntil ? `Hasta ${p.activeUntil}` : null) },
    { label: 'De', value: (p) => [p.city, p.country].filter(Boolean).join(', ') || null },
    { label: 'Sello', value: (p) => p.labels.join(' · ') || null },
    { label: 'Estilos', value: (p) => p.styles.join(' · ') || null },
    { label: 'Top en', value: (p) => p.topIn.map((x) => `${x.country} #${x.rank}`).join(' · ') || null },
  ]
  const visible = rows.filter((r) => artists.some((a) => profiles[a.slug] && r.value(profiles[a.slug])))
  if (!visible.length) return null
  return (
    <section aria-labelledby="versus-facts" className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <h3 id="versus-facts" className="font-poster text-2xl tracking-wide text-white">
        La ficha
      </h3>
      <dl className="flex flex-col divide-y divide-white/10">
        {visible.map((r) => (
          <div key={r.label} className="grid gap-x-3 gap-y-1 py-2" style={{ gridTemplateColumns: `4.5rem repeat(${artists.length}, minmax(0, 1fr))` }}>
            <dt className="text-xs font-bold tracking-wide text-white/50 uppercase">{r.label}</dt>
            {artists.map((a) => (
              <dd key={a.slug} className="min-w-0 text-sm break-words text-white" style={{ '--artist': a.color ?? '#ff4fd0' } as CSSProperties}>
                {(profiles[a.slug] && r.value(profiles[a.slug])) ?? <span className="text-white/40">—</span>}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    </section>
  )
}
