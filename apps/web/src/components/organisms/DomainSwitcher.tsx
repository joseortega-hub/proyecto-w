import { useLocation, useNavigate } from 'react-router'
import { DomainPicker, DomainTabs } from '@/components/molecules'
import { domainIcon, useDomain, useDomains } from '@/lib/domain'

/** Secciones que existen en todos los dominios: al cambiar de temática se conserva la sección. */
const SHARED_SECTIONS = new Set(['biblioteca', 'listas'])

/** Temáticas con contenido (o personales), la actual y cómo cambiar a otra conservando la sección. */
export function useDomainTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { id } = useDomain()
  const domains = useDomains()
  const tabs = (domains.data ?? [])
    .filter((d) => d.itemCount > 0 || d.personal)
    .map((d) => ({ id: d.id, label: d.name, icon: domainIcon(d.id), count: d.itemCount }))
  const section = pathname.split('/')[2] ?? ''
  const select = (next: string) => navigate(`/${next}${SHARED_SECTIONS.has(section) ? `/${section}` : ''}`)
  return { tabs, current: id, select }
}

/**
 * Cambio de temática: lista vertical en las barras laterales; en el móvil, un botón con la
 * actual que abre una hoja con todas («picker», en la cabecera o en la barra inferior).
 */
export function DomainSwitcher({ variant = 'vertical', className }: { variant?: 'vertical' | 'pill' | 'tab'; className?: string }) {
  const { tabs, current, select } = useDomainTabs()
  if (tabs.length < 2) return null
  return variant === 'vertical' ? (
    <DomainTabs tabs={tabs} current={current} orientation="vertical" className={className} onSelect={select} />
  ) : (
    <DomainPicker tabs={tabs} current={current} variant={variant} className={className} onSelect={select} />
  )
}
