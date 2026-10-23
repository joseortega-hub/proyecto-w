import { Link } from 'react-router'
import { Heading, IconButton } from '@/components/atoms'
import { useTheme } from '@/lib/theme'

/** Cabecera móvil: marca y cambio de tema. En escritorio la marca va en la barra lateral. */
export function AppHeader() {
  const { theme, toggle } = useTheme()
  return (
    <header className="flex items-center justify-between px-5 pt-5 md:hidden">
      <Link to="/" className="rounded-sm">
        <Heading as="span" size="brand">
          Sintonía
        </Heading>
      </Link>
      <IconButton icon="theme" label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} onClick={toggle} />
    </header>
  )
}
