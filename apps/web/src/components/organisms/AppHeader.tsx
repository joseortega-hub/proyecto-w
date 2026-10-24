import { Link, useNavigate } from 'react-router'
import { Heading, IconButton } from '@/components/atoms'
import { useTheme } from '@/lib/theme'
import { DomainSwitcher } from './DomainSwitcher'
import { ThemeMenu } from './ThemeMenu'

/** Cabecera móvil: marca, estilo (🎨), modo claro/oscuro y pestañas de temática. En escritorio van en la barra lateral. */
export function AppHeader() {
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  return (
    <header className="flex flex-col gap-3 px-5 pt-5 md:hidden">
      <div className="flex items-center justify-between">
        <Link to="/" className="rounded-sm">
          <Heading as="span" size="brand">
            Sintonía
          </Heading>
        </Link>
        <div className="flex gap-2">
          <IconButton icon="activity" variant="ghost" label="Bajo el capó: la IA por dentro" onClick={() => navigate('/bajo-el-capo')} />
          <ThemeMenu />
          <IconButton icon="theme" label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle} />
        </div>
      </div>
      <DomainSwitcher className="-mx-5 px-5" />
    </header>
  )
}
