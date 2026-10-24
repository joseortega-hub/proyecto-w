import type { ItemDetails } from './api'

export interface SheetRow {
  label: string
  value: string
}

const join = (list?: string[]) => (list?.length ? list.join(', ') : undefined)
const date = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const rated = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 1 })
const present = <T,>(v: T | undefined | null | false | ''): v is T => !!v

/**
 * Línea corta bajo cada elemento de una lista ("Dir. James Gunn · 2014 · Chris Pratt, Zoe Saldaña").
 * Solo con datos de las APIs; vacía si no hay nada que mostrar.
 */
export function geekLine(domainId: string, d: ItemDetails | undefined): string | null {
  if (!d) return null
  const parts: (string | undefined)[] =
    domainId === 'movies'
      ? [d.director && `Dir. ${d.director}`, d.year?.toString(), join(d.cast?.slice(0, 2))]
      : domainId === 'games'
        ? [join(d.publishers?.filter((p) => !d.developers?.includes(p)).slice(0, 1)), d.year?.toString(), d.metacritic ? `Metacritic ${d.metacritic}` : undefined]
        : domainId === 'books'
          ? [d.year ? `1.ª ed. ${d.year}` : undefined, d.pages ? `${d.pages} págs.` : undefined]
          : [d.album, d.year?.toString(), d.producers?.length ? `Prod. ${d.producers.slice(0, 2).join(', ')}` : undefined]
  return parts.filter(present).join(' · ') || null
}

/** Filas de la "Ficha técnica" de la ficha; solo las que tienen dato. */
export function techSheet(domainId: string, d: ItemDetails | undefined): SheetRow[] {
  if (!d) return []
  const rows: (SheetRow | undefined | '' | 0)[] =
    domainId === 'movies'
      ? [
          d.director && { label: 'Dirección', value: d.director },
          d.cast?.length && { label: 'Reparto', value: join(d.cast)! },
          d.year && { label: 'Año', value: String(d.year) },
          d.runtimeMin && { label: 'Duración', value: `${Math.floor(d.runtimeMin / 60)} h ${String(d.runtimeMin % 60).padStart(2, '0')} min` },
          d.rating && { label: 'Nota', value: `${rated(d.rating)} / 10` },
        ]
      : domainId === 'games'
        ? [
            d.developers?.length && { label: 'Estudio', value: join(d.developers)! },
            d.publishers?.length && { label: 'Editora', value: join(d.publishers)! },
            d.released && { label: 'Lanzamiento', value: date.format(new Date(d.released)) },
            d.metacritic && { label: 'Metacritic', value: String(d.metacritic) },
            d.platforms?.length && { label: 'Plataformas', value: join(d.platforms)! },
          ]
        : domainId === 'books'
          ? [
              d.authors?.length && { label: 'Autoría', value: join(d.authors)! },
              d.year && { label: 'Primera edición', value: String(d.year) },
              d.pages && { label: 'Páginas', value: String(d.pages) },
              d.subjects?.length && { label: 'Temas', value: join(d.subjects)! },
            ]
          : [
              d.album && { label: 'Álbum', value: d.album },
              d.year && { label: 'Año', value: String(d.year) },
              d.producers?.length && { label: 'Producción', value: join(d.producers)! },
              d.composers?.length && { label: 'Composición', value: join(d.composers)! },
              d.lyricists?.length && { label: 'Letra', value: join(d.lyricists)! },
              d.featured?.length && { label: 'Colaboraciones', value: join(d.featured)! },
            ]
  return rows.filter((r): r is SheetRow => !!r)
}
