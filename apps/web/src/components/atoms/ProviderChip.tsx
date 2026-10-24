import type { CSSProperties } from 'react'
import { providerHue, providerName } from '@/lib/ops-format'
import { cn } from '@/lib/utils'

/** Chip con el color del proveedor de IA (Groq, Laya, Gemini…). */
export function ProviderChip({ provider, failed, className }: { provider: string; failed?: boolean; className?: string }) {
  return (
    <span
      style={{ '--hue': providerHue(provider) } as CSSProperties}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-(--hue) bg-[color-mix(in_oklab,var(--hue)_16%,transparent)] px-2.5 py-0.5 text-[13px] font-bold text-foreground',
        failed && 'opacity-70',
        className,
      )}
    >
      <span aria-hidden className="size-2 rounded-full bg-(--hue)" />
      <span className={cn(failed && 'line-through')}>{providerName(provider)}</span>
    </span>
  )
}
