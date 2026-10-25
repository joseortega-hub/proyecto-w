import type { ReactNode } from 'react'
import { useHiddenSections, type SectionId } from '@/lib/sections'

/** Pinta su contenido salvo que la persona haya ocultado esa sección en «Personalizar». */
export function Hideable({ id, children }: { id: SectionId; children: ReactNode }) {
  const { isHidden } = useHiddenSections()
  return isHidden(id) ? null : children
}
