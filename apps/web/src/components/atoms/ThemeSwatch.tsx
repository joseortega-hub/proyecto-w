import { cn } from '@/lib/utils'

/** Muestra de un tema: sus colores principales en círculos solapados. Decorativa: el nombre va al lado. */
export function ThemeSwatch({ colors, className }: { colors: string[]; className?: string }) {
  return (
    <span aria-hidden className={cn('flex flex-none -space-x-1.5', className)}>
      {colors.map((c, i) => (
        <span key={i} className="size-5 rounded-full border border-foreground/15 shadow-xs" style={{ backgroundColor: c }} />
      ))}
    </span>
  )
}
