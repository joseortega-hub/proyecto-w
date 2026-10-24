import type { VibeGradient } from '@/lib/vibe/vibe-color'
import type { VibeTitle } from '@/lib/vibe/vibe-title'

/** Cabecera de "Tu vibra": el nombre de la vibra sobre su degradado (la tinta pasa AA sobre los dos extremos). */
export function VibeHeader({ title, gradient }: { title: VibeTitle; gradient: VibeGradient }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[14px] px-4 py-3.5" style={{ background: gradient.css, color: gradient.ink }}>
      <span aria-hidden className="text-[44px] leading-none drop-shadow-sm">
        {title.emoji}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-widest">Tu vibra</span>
        <h2 className="font-display text-[22px] font-extrabold leading-[1.1] text-balance">{title.text}</h2>
        {title.context && <span className="text-xs font-semibold">{title.context}</span>}
      </div>
    </div>
  )
}
