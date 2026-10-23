import { Text } from '@/components/atoms'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { Preference } from '@/lib/preferences'
import { cn } from '@/lib/utils'

interface PreferencePickerProps {
  preference: Preference
  value: string | undefined
  onChange: (value: string) => void
}

/** Una preferencia previa (p. ej. "Idioma de la letra: Español · Inglés · Me da igual"). */
export function PreferencePicker({ preference, value, onChange }: PreferencePickerProps) {
  // Con muchas opciones (plataformas), cada una ocupa lo que necesita y saltan de línea.
  const many = preference.options.length > 3
  return (
    <div className="flex flex-col gap-2">
      <Text as="span" font="label">
        {preference.label}
      </Text>
      <ToggleGroup
        type="single"
        value={value ?? preference.anyValue}
        // Al pulsar la opción ya marcada no se deja vacío: siempre hay una elegida.
        onValueChange={(v) => v && onChange(v)}
        aria-label={preference.label}
        className={cn('flex w-full gap-2', many && 'flex-wrap')}
      >
        {preference.options.map((o) => (
          <ToggleGroupItem
            key={o.value}
            value={o.value}
            className={cn(
              'h-10 rounded-full! border-[1.5px] border-border bg-card px-3 text-sm font-bold data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
              many ? 'flex-none px-4' : 'flex-1',
            )}
          >
            {o.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
