import { Popover } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Icon, IconButton, Switch, type IconName } from '@/components/atoms'
import { openFeedback } from '@/lib/feedback'
import { useHiddenSections } from '@/lib/sections'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { CustomizePanel } from './CustomizeMenu'
import { ThemePanel } from './ThemeMenu'

export interface SettingsLink {
  to: string
  label: string
  icon: IconName
}

interface SettingsMenuProps {
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Enlaces que la estructura no lleva en su barra (p. ej. «Mis gustos» en «Una mano»). */
  extraLinks?: SettingsLink[]
  /** Botón propio (debe aceptar ref y props); por defecto, un botón redondo «⋯». */
  children?: ReactNode
}

const GLOBAL_LINKS: SettingsLink[] = [
  { to: '/historia', label: 'Tu historia', icon: 'calendar' },
  { to: '/bajo-el-capo', label: 'Bajo el capó', icon: 'activity' },
]

const rowClass =
  'flex min-h-12 w-full items-center gap-3 rounded-md px-2.5 text-left text-[15px] hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

function Row({ icon, label, hint, onClick, chevron }: { icon: IconName; label: string; hint?: string; onClick: () => void; chevron?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={rowClass}>
      <Icon name={icon} className="flex-none text-domain" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">{label}</span>
        {hint && <span className="truncate text-[13px] text-muted-foreground">{hint}</span>}
      </span>
      {chevron && <Icon name="chevronDown" className="size-4 flex-none -rotate-90 text-muted-foreground" />}
    </button>
  )
}

/**
 * Un solo menú para todo lo que no es navegar: modo claro u oscuro, estilo, «Personalizar»,
 * «Tu historia», «Bajo el capó» y el buzón. Estilo y Personalizar se abren dentro, con «Volver».
 */
export function SettingsMenu({ side = 'bottom', align = 'end', extraLinks = [], children }: SettingsMenuProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'root' | 'theme' | 'customize'>('root')
  const { theme, palette, themes, toggle } = useTheme()
  const { hidden } = useHiddenSections()
  const navigate = useNavigate()
  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }
  const style = themes.find((t) => t.id === palette)?.label ?? palette
  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setView('root')
      }}
    >
      <Popover.Trigger asChild>{children ?? <IconButton icon="more" variant="ghost" label="Ajustes y más" />}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className="z-50 max-h-[min(36rem,calc(100dvh-24px))] w-[min(21rem,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
        >
          {view === 'root' ? (
            <div className="flex flex-col">
              <div className={cn(rowClass, 'hover:bg-transparent')}>
                <Icon name={theme === 'dark' ? 'moon' : 'sun'} className="flex-none text-domain" />
                <span className="flex-1 font-semibold">Modo oscuro</span>
                <Switch checked={theme === 'dark'} onCheckedChange={toggle} label="Modo oscuro" />
              </div>
              <Row icon="palette" label="Estilo" hint={style} chevron onClick={() => setView('theme')} />
              <Row
                icon="customize"
                label="Personalizar"
                hint={hidden.length ? `Estructura y secciones · ${hidden.length} ocultas` : 'Estructura y secciones'}
                chevron
                onClick={() => setView('customize')}
              />
              <hr className="my-2 border-border" />
              {[...extraLinks, ...GLOBAL_LINKS].map((l) => (
                <Row key={l.to} icon={l.icon} label={l.label} onClick={() => go(l.to)} />
              ))}
              <Row
                icon="feedback"
                label="Buzón de comentarios"
                hint="Cuéntanos un error, una idea o una mejora."
                onClick={() => {
                  setOpen(false)
                  openFeedback()
                }}
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 pb-2">
                <IconButton icon="back" label="Volver a los ajustes" variant="ghost" onClick={() => setView('root')} />
                <p className="label-caps">Ajustes</p>
              </div>
              {view === 'theme' ? <ThemePanel /> : <CustomizePanel />}
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
