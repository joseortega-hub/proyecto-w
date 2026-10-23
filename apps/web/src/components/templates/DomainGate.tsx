import { Navigate, Outlet } from 'react-router'
import { useDomain } from '@/lib/domain'

/** Raíz de /:domain/…: si el dominio no existe, vuelve al selector de temáticas. */
export function DomainGate() {
  const { exists } = useDomain()
  if (!exists) return <Navigate to="/" replace />
  return <Outlet />
}
