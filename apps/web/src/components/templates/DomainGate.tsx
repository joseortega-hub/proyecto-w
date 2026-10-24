import { Navigate, Outlet } from 'react-router'
import { useDomain } from '@/lib/domain'
import { useNeonTheme, usePerreoUnlock } from '@/lib/perreo'

/** Raíz de /:domain/…: si el dominio no existe, vuelve al selector de temáticas. */
export function DomainGate() {
  const { exists, id, info } = useDomain()
  const unlocked = usePerreoUnlock() !== null
  // La temática secreta solo existe para quien la ha desbloqueado; con ella, el tema neón.
  useNeonTheme(id === 'perreo' && unlocked)
  if (!exists || (info?.hidden && !unlocked)) return <Navigate to="/" replace />
  return <Outlet />
}
