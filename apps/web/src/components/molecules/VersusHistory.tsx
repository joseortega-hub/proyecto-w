import { useState, type CSSProperties } from 'react'
import { growthLabel, HISTORY_LABELS, historyLines, historyMetrics, releaseWhen, type HistoryPoint, type PulseArtist } from '@/lib/perreo-pulse'
import { cn } from '@/lib/utils'

interface VersusHistoryProps {
  artists: PulseArtist[]
  history?: Record<string, HistoryPoint[]>
  /** Días distintos con foto del pulso. */
  days?: number
  className?: string
}

/**
 * La evolución en el 1 vs 1: una línea del color de cada artista con las fotos diarias de
 * `perreo:pulse`. Con menos de 2 días lo dice claro en vez de dibujar una raya plana.
 */
export function VersusHistory({ artists, history, days = 0, className }: VersusHistoryProps) {
  const metrics = days >= 2 ? historyMetrics(history) : []
  const [picked, setPicked] = useState(metrics[0])
  const metric = picked && metrics.includes(picked) ? picked : metrics[0]
  return (
    <section aria-labelledby="versus-history" className={cn('flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3', className)}>
      <h3 id="versus-history" className="font-poster text-2xl tracking-wide text-white">
        La evolución
      </h3>
      {!metric || !history ? (
        <p className="text-white/70">El historial empieza hoy: vuelve en unos días y verás quién sube más rápido 📈</p>
      ) : (
        <Chart artists={artists} history={history} metric={metric} metrics={metrics} onPick={setPicked} />
      )}
    </section>
  )
}

function Chart({ artists, history, metric, metrics, onPick }: { artists: PulseArtist[]; history: Record<string, HistoryPoint[]>; metric: (typeof metrics)[number]; metrics: ReturnType<typeof historyMetrics>; onPick: (m: (typeof metrics)[number]) => void }) {
  const { days, lines } = historyLines(history, metric)
  const W = 320
  const H = 120
  const pad = 6
  const px = (x: number) => pad + x * (W - pad * 2)
  const py = (y: number) => H - pad - y * (H - pad * 2)
  return (
    <>
      {metrics.length > 1 && (
        <div role="group" aria-label="Qué cifra ver" className="flex flex-wrap gap-1.5">
          {metrics.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={m === metric}
              onClick={() => onPick(m)}
              className={cn('min-h-9 rounded-full border px-3 text-xs font-bold', m === metric ? 'border-[var(--artist)] bg-[var(--artist)] text-black' : 'border-white/20 text-white/80')}
            >
              {HISTORY_LABELS[m]}
            </button>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${HISTORY_LABELS[metric]} del ${releaseWhen(days[0])} al ${releaseWhen(days.at(-1)!)}`}>
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="currentColor" className="text-white/15" />
        {artists.map((a) => {
          const pts = lines[a.slug]?.points ?? []
          if (!pts.length) return null
          const color = a.color ?? '#ff4fd0'
          return (
            <g key={a.slug}>
              <polyline className="versus-line" pathLength={1} points={pts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={px(pts.at(-1)!.x)} cy={py(pts.at(-1)!.y)} r={4.5} fill={color} />
            </g>
          )
        })}
      </svg>
      <div className="flex justify-between text-xs text-white/50">
        <span>{releaseWhen(days[0])}</span>
        <span>{releaseWhen(days.at(-1)!)}</span>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {artists.map((a) => (
          <li key={a.slug} className="flex items-center gap-1.5 text-sm text-white/80" style={{ '--artist': a.color ?? '#ff4fd0' } as CSSProperties}>
            <span aria-hidden className="size-2.5 rounded-full bg-[var(--artist)]" />
            {a.name}
            <strong className="text-[var(--artist)] tabular-nums">{growthLabel(lines[a.slug]?.growth ?? null) || 'sin dato'}</strong>
          </li>
        ))}
      </ul>
    </>
  )
}
