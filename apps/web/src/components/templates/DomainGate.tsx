import { Navigate, Outlet } from 'react-router'
import { DEFAULT_DOMAIN, useDomain } from '@/lib/domain'

/** Raíz de /:domain/…: si el dominio no existe, vuelve al de por defecto. */
export function DomainGate() {
  const { exists } = useDomain()
  if (!exists) return <Navigate to={`/${DEFAULT_DOMAIN}`} replace />
  return <Outlet />
}
