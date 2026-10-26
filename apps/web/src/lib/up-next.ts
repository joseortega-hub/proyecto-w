import type { UpNextEntry } from '@/components/molecules'
import type { Item } from './api'

/**
 * «A continuación» en la ficha abierta desde una lista (temáticas sin reproductor): los
 * siguientes de la lista en su orden (el editado). Si el elemento no está en la lista, nada.
 */
export function upNextInList(entries: { item: Pick<Item, 'id' | 'title' | 'subtitle' | 'imageUrl'> }[], currentId: string, limit: number): UpNextEntry[] {
  const at = entries.findIndex((e) => e.item.id === currentId)
  if (at < 0) return []
  return entries.slice(at + 1, at + 1 + limit).map(({ item }, i) => ({ index: at + 1 + i, title: item.title, subtitle: item.subtitle, imageUrl: item.imageUrl }))
}
