import { Link, useNavigate } from 'react-router'
import { Heading, IconButton } from '@/components/atoms'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { DomainSwitcher } from './DomainSwitcher'
import { CustomizeMenu } from './CustomizeMenu'
import { ThemeMenu } from './ThemeMenu'

const HIDE_FROM = { md: 'md:hidden', lg: 'lg:hidden', never: '' }

/**
 * Cabecera: marca, estilo (🎨), personalizar, modo claro/oscuro y pestañas de temática.
 * Se oculta donde la navegación ya los lleva (la barra lateral desde 768 px, la columna de
 * temáticas de «Biblioteca» desde 1024 px); con el «Dock» se ve siempre.
 */
export function AppHeader({ hideFrom = 'md' }: { hideFrom?: keyof typeof HIDE_FROM }) {
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  return (
    <header className={cn('flex flex-none flex-col gap-3 px-5 pt-5 short:flex-row short:items-center short:gap-2 short:pt-2 md:px-10', HIDE_FROM[hideFrom])}>
      <div className="flex flex-none items-center justify-between short:gap-2">
        <Link to="/" className="inline-flex min-h-11 items-center rounded-sm">
          <Heading as="span" size="brand">
            Sintonía
          </Heading>
        </Link>
        <div className="flex gap-1 min-[380px]:gap-2">
          <IconButton icon="activity" variant="ghost" label="Bajo el capó: la IA por dentro" onClick={() => navigate('/bajo-el-capo')} />
          <CustomizeMenu />
          <ThemeMenu />
          <IconButton icon="theme" label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle} />
        </div>
      </div>
      <DomainSwitcher className="-mx-5 px-5 short:mx-0 short:min-w-0 short:flex-1 short:px-0" />
    </header>
  )
}
