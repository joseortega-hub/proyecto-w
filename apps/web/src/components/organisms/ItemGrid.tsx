import { ItemCard } from '@/components/molecules'
import type { Item } from '@/lib/api'
import { formatDuration } from '@/lib/format'

/** Año del elemento, si la fuente lo da (`facets.year`). */
export const itemYear = (item: Pick<Item, 'facets'>) => {
  const year = item.facets?.year
  return typeof year === 'string' ? year : null
}

/** Cuadrícula de la biblioteca: 2 columnas en móvil, hasta 5 en escritorio. */
export function ItemGrid({ items, onSelect }: { items: Item[]; onSelect: (item: Item) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <li key={item.id} className="min-w-0">
          <ItemCard
            title={item.title}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            meta={[itemYear(item), item.durationSec ? formatDuration(item.durationSec) : null].filter(Boolean).join(' · ') || null}
            onSelect={() => onSelect(item)}
          />
        </li>
      ))}
    </ul>
  )
}
