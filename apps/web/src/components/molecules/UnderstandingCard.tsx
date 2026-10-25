import { Button, Heading, Skeleton, Text } from '@/components/atoms'
import { Card } from '@/components/ui/card'

export interface UnderstoodChip {
  id: string
  icon: string
  label: string
  /** Preferencias: opciones entre las que se puede corregir lo entendido. */
  options?: { value: string; label: string }[]
  value?: string
  /** Explicación bajo el chip (p. ej. «He entendido Sarah J. Maas» tras corregir una errata). */
  note?: string
}

interface UnderstandingCardProps {
  /** Lo entendido, listo para corregir; null mientras se lee el texto. */
  chips: UnderstoodChip[] | null
  onRemove: (id: string) => void
  onChange: (id: string, value: string) => void
  onStart: () => void
  starting?: boolean
}

/** "Esto es lo que he entendido": chips que se quitan o se corrigen antes de empezar la entrevista. */
export function UnderstandingCard({ chips, onRemove, onChange, onStart, starting }: UnderstandingCardProps) {
  return (
    <Card className="gap-4 rounded-lg border-border p-6 shadow-md">
      <div className="flex flex-col gap-1.5">
        <Text font="label">Esto es lo que he entendido</Text>
        <Heading size="question">¿Voy bien?</Heading>
        <Text tone="muted" size="sm">
          Quita o cambia lo que no sea y empezamos.
        </Text>
      </div>
      {chips ? (
        <ul className="flex flex-wrap gap-2" aria-label="Lo que he entendido">
          {chips.map((c) => (
            <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-domain-soft py-1 pr-1 pl-3 text-[14px] font-bold">
              <span aria-hidden>{c.icon}</span>
              {c.options ? (
                <select
                  aria-label={c.label}
                  value={c.value}
                  onChange={(e) => onChange(c.id, e.target.value)}
                  className="max-w-40 truncate bg-transparent font-bold outline-none"
                >
                  {c.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span>
                  {c.label}
                  {c.note && <span className="block text-[12px] font-normal text-muted-foreground">{c.note}</span>}
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                aria-label={`Quitar ${c.label}`}
                className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                ✕
              </button>
            </li>
          ))}
          {chips.length === 0 && (
            <Text tone="muted" size="sm">
              Nada concreto: te pregunto desde cero.
            </Text>
          )}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-2" aria-busy aria-label="Leyendo lo que me cuentas">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      )}
      <Button block disabled={!chips || starting} onClick={onStart}>
        Empezar
      </Button>
    </Card>
  )
}
