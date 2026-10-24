import { Icon, IconButton, type IconName, ThemeSwatch } from '@/components/atoms'
import type { Theme, ThemeInfo, ThemeMode } from '@/lib/theme'
import { cn } from '@/lib/utils'

const MODES: { id: ThemeMode; label: string; icon: IconName }[] = [
  { id: 'system', label: 'Sistema', icon: 'system' },
  { id: 'light', label: 'Claro', icon: 'sun' },
  { id: 'dark', label: 'Oscuro', icon: 'moon' },
]

type ThemePickerProps = {
  themes: ThemeInfo[]
  palette: string
  mode: ThemeMode
  /** Modo efectivo, para enseñar las muestras como se verán. */
  theme: Theme
  onPalette: (id: string) => void
  onMode: (mode: ThemeMode) => void
  /** Al pasar por encima o enfocar un tema (para precargar sus fuentes). */
  onPreview?: (id: string) => void
  /** Ids de los temas propios (hechos con IA): llevan un botón para borrarlos. */
  customIds?: string[]
  onRemove?: (id: string) => void
  /** Abre el creador de temas con IA (si falta, no se ofrece). */
  onCreate?: () => void
  className?: string
}

/** Lista de temas con su muestra de colores y el modo (Sistema · Claro · Oscuro). */
export function ThemePicker({ themes, palette, mode, theme, onPalette, onMode, onPreview, customIds = [], onRemove, onCreate, className }: ThemePickerProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div role="radiogroup" aria-label="Estilo" className="flex flex-col gap-0.5">
        {themes.map((t) => {
          const selected = t.id === palette
          const custom = customIds.includes(t.id)
          return (
            <div key={t.id} className="flex items-center gap-1">
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPalette(t.id)}
              onPointerEnter={() => onPreview?.(t.id)}
              onFocus={() => onPreview?.(t.id)}
              className={cn(
                'flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary',
              )}
            >
              <ThemeSwatch colors={t.modes[theme].swatches} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-bold">{t.label}</span>
                <span className={cn('text-xs leading-snug', selected ? 'text-accent-foreground/80' : 'text-muted-foreground')}>{t.description}</span>
              </span>
              <Icon name="check" className={cn('size-4 flex-none', !selected && 'invisible')} />
            </button>
              {custom && onRemove && <IconButton icon="trash" label={`Borrar el tema ${t.label}`} onClick={() => onRemove(t.id)} />}
            </div>
          )
        })}
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="mt-1 flex min-h-12 items-center gap-3 rounded-md border border-dashed border-border px-2.5 py-2 text-left text-sm font-bold transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Icon name="sparkles" className="size-5 flex-none text-primary" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span>Crear con IA ✨</span>
              <span className="text-xs font-normal text-muted-foreground">Descríbelo y se aplica al instante</span>
            </span>
          </button>
        )}
      </div>
      <div role="radiogroup" aria-label="Modo" className="grid grid-cols-3 gap-1 rounded-md bg-secondary p-1">
        {MODES.map((m) => {
          const selected = m.id === mode
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onMode(m.id)}
              className={cn(
                'flex min-h-9 items-center justify-center gap-1.5 rounded-sm text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4',
                selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon name={m.icon} />
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
