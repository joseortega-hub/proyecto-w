import { menuModes } from '@sintonia/tokens/engine'
import { Popover } from 'radix-ui'
import { useState } from 'react'
import { IconButton } from '@/components/atoms'
import { ThemeCreator, type ThemeCreatorStatus, ThemePicker } from '@/components/molecules'
import { api, ApiError } from '@/lib/api'
import { MAX_CUSTOM, type ThemeDraft } from '@/lib/custom-themes'
import { preloadThemeFonts, useTheme } from '@/lib/theme'

type ThemeMenuProps = {
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

/** Botón 🎨 con el desplegable de temas: cambia el estilo de toda la app al instante (solo variables CSS). */
export function ThemeMenu({ side = 'bottom', align = 'end' }: ThemeMenuProps) {
  const { theme, mode, palette, themes, customs, setMode, setPalette, setDraft, saveDraft, removeCustom } = useTheme()
  const current = themes.find((t) => t.id === palette)
  const [creating, setCreating] = useState(false)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ThemeCreatorStatus>('idle')
  const [error, setError] = useState<string>()
  const [draft, setLocalDraft] = useState<ThemeDraft | null>(null)
  const [variant, setVariant] = useState(0)

  const reset = () => {
    setDraft(null)
    setLocalDraft(null)
    setStatus('idle')
    setError(undefined)
    setVariant(0)
  }
  const generate = async (next: number) => {
    setStatus('loading')
    setError(undefined)
    try {
      const generated = await api.generateTheme(description.trim(), next)
      setVariant(next)
      setLocalDraft(generated)
      setDraft(generated)
      setStatus('ready')
    } catch (e) {
      // Si ya había una vista previa, se queda; si no, se muestra el error.
      setStatus(draft ? 'ready' : 'error')
      setError(e instanceof ApiError && e.status === 400 ? 'Descríbelo con algo más de detalle.' : 'No he podido crear el tema ahora mismo. Prueba otra vez en un momento.')
    }
  }
  const proposal = draft && {
    label: draft.theme.label,
    swatches: menuModes(draft.theme)[theme].swatches,
    notices: draft.notices,
  }

  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (!open) {
          reset()
          setCreating(false)
        }
      }}
    >
      <Popover.Trigger asChild>
        <IconButton icon="palette" label={`Cambiar el estilo (ahora: ${current?.label ?? palette})`} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-h-[min(34rem,calc(100dvh-24px))] w-[min(20rem,calc(100vw-24px))] overflow-y-auto rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
        >
          {creating ? (
            <>
              <div className="flex items-center gap-1 pb-2">
                <IconButton
                  icon="back"
                  label="Volver a los estilos"
                  variant="ghost"
                  onClick={() => {
                    reset()
                    setCreating(false)
                  }}
                />
                <p className="label-caps">Crear con IA ✨</p>
              </div>
              <ThemeCreator
                description={description}
                onDescription={setDescription}
                status={status}
                proposal={proposal ?? undefined}
                error={error}
                canSave={customs.length < MAX_CUSTOM}
                onGenerate={() => generate(0)}
                onAnother={() => generate(variant + 1)}
                onSave={() => {
                  if (saveDraft(description.trim())) {
                    reset()
                    setCreating(false)
                    setDescription('')
                  }
                }}
                onDiscard={reset}
              />
            </>
          ) : (
            <>
              <p className="label-caps px-2.5 pt-1.5 pb-2">Estilo</p>
              <ThemePicker
                themes={themes}
                palette={palette}
                mode={mode}
                theme={theme}
                onPalette={setPalette}
                onMode={setMode}
                onPreview={preloadThemeFonts}
                customIds={customs.map((t) => t.id)}
                onRemove={removeCustom}
                onCreate={() => setCreating(true)}
              />
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
