import { Meter } from '@/components/atoms'
import { formatScore } from '@/lib/format'

/** Un atributo del perfil: nombre, barra y valor numérico. */
export function AttributeMeter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr_44px] items-center gap-3 text-[15px]" title={hint}>
      <span>{label}</span>
      <Meter value={value} label={label} />
      <span className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">{formatScore(value)}</span>
    </div>
  )
}
