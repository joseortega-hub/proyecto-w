import { cn } from '@/lib/utils'

export type VibeSourceKey = 'text' | 'answer' | 'taste' | 'context' | 'guess' | 'you'

export const VIBE_SOURCES: Record<VibeSourceKey, { icon: string; label: string }> = {
  text: { icon: '💬', label: 'tu texto' },
  answer: { icon: '❓', label: 'tu respuesta' },
  taste: { icon: '❤️', label: 'tus gustos' },
  context: { icon: '🌦️', label: 'el contexto' },
  guess: { icon: '💭', label: 'una suposición' },
  you: { icon: '👆', label: 'lo has movido tú' },
}

/** Icono del origen de una dimensión. Lo seguro va sólido; lo supuesto, punteado. */
export function VibeSourceIcon({ source, solid = true, className }: { source: VibeSourceKey; solid?: boolean; className?: string }) {
  const s = VIBE_SOURCES[source]
  return (
    <span
      role="img"
      aria-label={`Viene de ${s.label}${solid ? '' : ' (supuesto)'}`}
      title={`${s.label}${solid ? '' : ' · supuesto'}`}
      className={cn(
        'inline-grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] text-[13px] leading-none',
        solid ? 'border-solid border-primary bg-accent' : 'border-dotted border-muted-foreground bg-transparent opacity-80',
        className,
      )}
    >
      {s.icon}
    </span>
  )
}
