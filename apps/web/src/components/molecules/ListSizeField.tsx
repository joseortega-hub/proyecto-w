import { DualRange, Text } from '@/components/atoms'
import { SIZE_LIMITS, type ListSize } from '@/lib/list-size'

interface ListSizeFieldProps {
  value: ListSize
  onChange: (value: ListSize) => void
  /** Lo que se cuenta: «canciones», «películas»… */
  noun: string
}

/** Cuántos elementos quiere en la lista: un mínimo y un máximo, no un número cerrado. */
export function ListSizeField({ value, onChange, noun }: ListSizeFieldProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-border bg-card px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <Text font="label">Tamaño de la lista</Text>
        <Text as="span" size="sm" className="font-mono tabular-nums">
          {value.min === value.max ? value.min : `${value.min}–${value.max}`} {noun}
        </Text>
      </div>
      <DualRange
        min={SIZE_LIMITS.min}
        max={SIZE_LIMITS.max}
        low={value.min}
        high={value.max}
        labelLow={`Mínimo de ${noun}`}
        labelHigh={`Máximo de ${noun}`}
        onChange={(min, max) => onChange({ min, max })}
      />
      <Text size="xs" tone="muted">
        Meto todo lo que encaja bien hasta el máximo; si no llega al mínimo, lo completo con lo más parecido.
      </Text>
    </div>
  )
}
