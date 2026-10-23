import { useLocation, useNavigate } from 'react-router'
import { DomainTabs } from '@/components/molecules'
import { domainIcon, useDomain, useDomains } from '@/lib/domain'

/** Secciones que existen en todos los dominios: al cambiar de temática se conserva la sección. */
const SHARED_SECTIONS = new Set(['biblioteca', 'listas'])

/** Pestañas para cambiar de temática sin pasar por el selector de Inicio. */
export function DomainSwitcher({ orientation = 'horizontal', className }: { orientation?: 'horizontal' | 'vertical'; className?: string }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { id } = useDomain()
  const domains = useDomains()
  const tabs = (domains.data ?? [])
    .filter((d) => d.itemCount > 0)
    .map((d) => ({ id: d.id, label: d.name, icon: domainIcon(d.id) }))
  if (tabs.length < 2) return null

  const section = pathname.split('/')[2] ?? ''
  return (
    <DomainTabs
      tabs={tabs}
      current={id}
      orientation={orientation}
      className={className}
      onSelect={(next) => navigate(`/${next}${SHARED_SECTIONS.has(section) ? `/${section}` : ''}`)}
    />
  )
}
