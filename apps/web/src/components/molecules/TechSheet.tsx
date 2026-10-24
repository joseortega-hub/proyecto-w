import { Text } from '@/components/atoms'
import type { SheetRow } from '@/lib/details'
import { cn } from '@/lib/utils'

interface TechSheetProps {
  rows: SheetRow[]
  /** De dónde salen los datos (se muestra como nota al pie). */
  source?: string
  className?: string
}

/** "Ficha técnica" de un elemento: créditos y datos que traen las APIs, en filas de etiqueta y valor. */
export function TechSheet({ rows, source, className }: TechSheetProps) {
  if (!rows.length) return null
  return (
    <section className={cn('flex flex-col gap-2', className)} aria-label="Ficha técnica">
      <Text font="label">Ficha técnica</Text>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
        {rows.map((r) => (
          <div key={r.label} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="min-w-0 text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
      {source && <p className="text-[12px] text-muted-foreground">Datos de {source}.</p>}
    </section>
  )
}
