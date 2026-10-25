import { useEffect, useState, type CSSProperties } from 'react'
import { Icon } from '@/components/atoms'
import '@/styles/perreo.css'

interface UnlockBurstProps {
  /** Se llama al terminar la animación o al tocar para saltarla. */
  onDone: () => void
  /** Milisegundos que dura antes de terminar sola. */
  duration?: number
  /** Color del artista que ha abierto el modo (#rrggbb): estrobo, anillos, rayos y chispas van de su color. */
  color?: string | null
  /** Foto del artista: entra de golpe en el centro. */
  photoUrl?: string | null
  /** Cómo se le llama (apodo escrito por la persona o su nombre). */
  name?: string
}

const TITLE = 'MODO PERREO'
const SPARKS = Array.from({ length: 18 }, (_, i) => ({ a: `${(360 / 18) * i + (i % 2 ? 6 : -4)}deg`, d: `${32 + (i % 3) * 12}vmin` }))
const EQ = [0.5, 0.9, 0.35, 0.75, 1, 0.45, 0.8, 0.3, 0.95, 0.6, 0.4, 0.85]

/**
 * Animación de desbloqueo del Modo Perreo: estrobo del color del artista, ondas expansivas, rayos de escenario,
 * su foto entra de golpe (con temblor de pantalla y vibración en el móvil), chispas, el título cae letra a letra
 * y un ecualizador rebota abajo. Con `prefers-reduced-motion`, una portada fija con su color y nada se mueve.
 */
export function UnlockBurst({ onDone, duration = 3400, color, photoUrl, name }: UnlockBurstProps) {
  const [leaving, setLeaving] = useState(false)
  const [photoOk, setPhotoOk] = useState(true)
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // El golpe de la foto, también en la mano.
    const buzz = reduced ? 0 : window.setTimeout(() => navigator.vibrate?.([70, 50, 140]), 620)
    const out = window.setTimeout(() => setLeaving(true), (reduced ? 1400 : duration) - 350)
    const timer = window.setTimeout(onDone, reduced ? 1400 : duration)
    return () => [buzz, out, timer].forEach((t) => window.clearTimeout(t))
  }, [onDone, duration])

  const accent = color ?? '#ff4fd0'
  return (
    <button
      type="button"
      onClick={onDone}
      aria-label={`Modo Perreo desbloqueado${name ? ` por ${name}` : ''}. Toca para continuar`}
      data-domain="perreo"
      style={{ '--artist': accent } as CSSProperties}
      className={`fixed inset-0 z-50 overflow-hidden bg-[radial-gradient(circle_at_50%_42%,color-mix(in_oklab,var(--artist)_45%,#000)_0%,#06020c_68%)] text-white ${leaving ? 'unlock-leaving' : ''}`}
    >
      <span aria-hidden className="unlock-rays" />
      <span aria-hidden className="unlock-strobe absolute inset-0 bg-[var(--artist)]" />
      {[0, 0.16, 0.34].map((d) => (
        <span key={d} aria-hidden className="unlock-ring" style={{ animationDelay: `${0.55 + d}s` }} />
      ))}
      {SPARKS.map((s, i) => (
        <span key={i} aria-hidden className="unlock-spark" style={{ '--a': s.a, '--d': s.d, animationDelay: `${0.6 + (i % 4) * 0.03}s` } as CSSProperties} />
      ))}

      <span className="unlock-stage relative flex h-full flex-col items-center justify-center gap-5 px-4 pb-16 text-center">
        <span className="unlock-photo grid size-40 place-items-center overflow-hidden rounded-full border-4 border-[var(--artist)] bg-black/40 shadow-[0_0_60px_var(--artist)] min-[400px]:size-48">
          {photoUrl && photoOk ? (
            <img src={photoUrl} alt="" onError={() => setPhotoOk(false)} className="size-full object-cover object-top" />
          ) : (
            <Icon name="flame" className="size-20 text-[var(--artist)]" />
          )}
        </span>
        <span className="font-poster perreo-neon text-[clamp(3.2rem,15vw,7rem)] text-white" aria-hidden>
          {[...TITLE].map((ch, i) => (
            <span key={i} className="unlock-letter" style={{ animationDelay: `${0.72 + i * 0.045}s`, color: i < 4 ? '#fff' : 'var(--artist)' }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </span>
        <span className="unlock-rise text-lg font-bold opacity-95" style={{ animationDelay: '1.35s' }}>
          {name ? (
            <>
              Desbloqueado por <span className="text-[var(--artist)]">{name}</span> 🔥
            </>
          ) : (
            'Desbloqueado 🔥'
          )}
        </span>
        <span className="unlock-rise text-xs tracking-[0.3em] uppercase opacity-60" style={{ animationDelay: '1.8s' }}>
          Toca para entrar
        </span>
      </span>

      <span aria-hidden className="perreo-eq absolute inset-x-0 bottom-6 flex h-14 items-end justify-center gap-1.5">
        {EQ.map((h, i) => (
          <span key={i} style={{ height: `${h * 100}%`, animationDelay: `${(i % 5) * 0.11}s` }} />
        ))}
      </span>
    </button>
  )
}
