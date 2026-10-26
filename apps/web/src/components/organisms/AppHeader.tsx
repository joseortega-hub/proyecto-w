import { BrandLink } from '@/components/molecules'
import { cn } from '@/lib/utils'
import { DomainSwitcher } from './DomainSwitcher'
import { SettingsMenu } from './SettingsMenu'

const HIDE_FROM = { md: 'md:hidden', lg: 'lg:hidden', never: '' }

/**
 * Cabecera fina, en una sola fila: la marca (vuelve a «Hoy para ti»), la temática actual (toca
 * para cambiarla) y el menú de ajustes (⋯). Se oculta donde la navegación lateral ya lo lleva.
 */
export function AppHeader({ hideFrom = 'md' }: { hideFrom?: keyof typeof HIDE_FROM }) {
  return (
    <header className={cn('flex flex-none items-center gap-2 px-4 py-1.5 min-[400px]:px-5 md:px-10', HIDE_FROM[hideFrom])}>
      <BrandLink />
      <span className="flex-1" />
      <DomainSwitcher variant="pill" className="max-w-[11rem]" />
      <SettingsMenu />
    </header>
  )
}
