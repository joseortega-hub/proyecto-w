import { Meter } from '@/components/atoms'
import { formatScore } from '@/lib/format'

/** Un atributo del perfil: nombre, barra y valor numérico. `origin`: de dónde sale el valor. */
export function AttributeMeter({ label, value, hint, origin }: { label: string; value: number; hint?: string; origin?: 'measured' | 'ai' }) {
  return (
    <div className="grid grid-cols-[110px_1fr_44px] items-center gap-3 text-[15px]" title={hint}>
      <span className="flex flex-col leading-tight">
        {label}
        {origin && (
          <span className={origin === 'measured' ? 'text-[12px] font-bold text-domain' : 'text-[12px] text-muted-foreground'}>
            {origin === 'measured' ? 'medido' : 'estimado con IA'}
          </span>
        )}
      </span>
      <Meter value={value} label={label} />
      <span className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">{formatScore(value)}</span>
    </div>
  )
}
