import { Link } from 'react-router'
import { Heading, IconButton } from '@/components/atoms'
import { useTheme } from '@/lib/theme'
import { DomainSwitcher } from './DomainSwitcher'

/** Cabecera móvil: marca, cambio de tema y pestañas de temática. En escritorio van en la barra lateral. */
export function AppHeader() {
  const { theme, toggle } = useTheme()
  return (
    <header className="flex flex-col gap-3 px-5 pt-5 md:hidden">
      <div className="flex items-center justify-between">
        <Link to="/" className="rounded-sm">
          <Heading as="span" size="brand">
            Sintonía
          </Heading>
        </Link>
        <IconButton icon="theme" label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle} />
      </div>
      <DomainSwitcher className="-mx-5 px-5" />
    </header>
  )
}
