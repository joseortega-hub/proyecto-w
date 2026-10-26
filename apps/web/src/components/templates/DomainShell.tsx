import { useDomain } from '@/lib/domain'
import { HomePage } from '@/pages/HomePage'
import { PerreoHomePage } from '@/pages/PerreoHomePage'
import { AppShell } from './AppShell'
import { LayoutBoundary } from './LayoutBoundary'
import { PerreoShell } from './PerreoShell'

/** El Modo Perreo tiene su propio marco y su propia portada; el resto de temáticas, los de Sintonía. */
export function DomainShell() {
  return useDomain().id === 'perreo' ? (
    <PerreoShell />
  ) : (
    <LayoutBoundary>
      <AppShell />
    </LayoutBoundary>
  )
}

export function DomainHome() {
  return useDomain().id === 'perreo' ? <PerreoHomePage /> : <HomePage />
}
