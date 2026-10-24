import { Popover } from 'radix-ui'
import { IconButton } from '@/components/atoms'
import { ThemePicker } from '@/components/molecules'
import { preloadThemeFonts, THEMES, useTheme } from '@/lib/theme'

type ThemeMenuProps = {
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

/** Botón 🎨 con el desplegable de temas: cambia el estilo de toda la app al instante (solo variables CSS). */
export function ThemeMenu({ side = 'bottom', align = 'end' }: ThemeMenuProps) {
  const { theme, mode, palette, setMode, setPalette } = useTheme()
  const current = THEMES.find((t) => t.id === palette)
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <IconButton icon="palette" label={`Cambiar el estilo (ahora: ${current?.label ?? palette})`} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(20rem,calc(100vw-24px))] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
        >
          <p className="label-caps px-2.5 pt-1.5 pb-2">Estilo</p>
          <ThemePicker
            themes={THEMES}
            palette={palette}
            mode={mode}
            theme={theme}
            onPalette={setPalette}
            onMode={setMode}
            onPreview={preloadThemeFonts}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
