export type RepeatMode = 'off' | 'all' | 'one'

/** Orden aleatorio de 0..length-1 con `first` al principio (lo que suena ahora no se mueve). */
export function shuffledOrder(length: number, first: number, random: () => number = Math.random): number[] {
  const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== first)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  return first >= 0 && first < length ? [first, ...rest] : rest
}

/**
 * Qué canción va después. Sin aleatorio sigue el orden de la lista (el editado); con aleatorio sigue `order`.
 * `auto` = terminó sola (repetir una la repite); si no, es un toque en "Siguiente".
 * Devuelve `null` si no hay más y no se repite.
 */
export function nextIndex(opts: { index: number; length: number; order: number[] | null; repeat: RepeatMode; auto: boolean; random?: () => number }): number | null {
  const { index, length, order, repeat, auto } = opts
  if (!length) return null
  if (auto && repeat === 'one') return index
  if (order) {
    const at = order.indexOf(index)
    if (at >= 0 && at + 1 < order.length) return order[at + 1]
    return repeat === 'all' ? (shuffledOrder(length, -1, opts.random)[0] ?? null) : null
  }
  if (index + 1 < length) return index + 1
  return repeat === 'all' ? 0 : null
}

/** Qué canción va antes (con aleatorio, la anterior del orden aleatorio). */
export function previousIndex(index: number, order: number[] | null): number {
  if (!order) return Math.max(0, index - 1)
  const at = order.indexOf(index)
  return order[Math.max(0, at - 1)] ?? index
}

/** Tras editar la lista, vuelve a encontrar la canción que suena (por su id) o deja el índice si no está. */
export function reindex<T extends { id: string }>(before: T[], index: number, after: T[]): number {
  const id = before[index]?.id
  const found = id ? after.findIndex((e) => e.id === id) : -1
  return found >= 0 ? found : Math.min(index, Math.max(0, after.length - 1))
}
