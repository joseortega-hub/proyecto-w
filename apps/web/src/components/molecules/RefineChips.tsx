import { Text } from '@/components/atoms'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

interface RefineChipsProps {
  options: { key: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

/** Ajustes rápidos que relanzan la búsqueda sin repetir la entrevista. */
export function RefineChips({ options, value, onChange, disabled }: RefineChipsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Text as="span" font="label">
        Afinar
      </Text>
      <ToggleGroup
        type="multiple"
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        aria-label="Afinar la lista"
        className="flex flex-wrap gap-2"
      >
        {options.map((o) => (
          <ToggleGroupItem
            key={o.key}
            value={o.key}
            className="h-9 rounded-full! border-[1.5px] border-border bg-card px-3.5 text-sm font-bold data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
