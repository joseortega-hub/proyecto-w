// «Tu año en Sintonía»: el resumen y sus tarjetas 9:16 (PNG generado en la API con Satori).
import { useQuery } from '@tanstack/react-query'
import { api, type YearCardKind, type YearSummary } from './api'

const RATING = { loved: 'me encantó', liked: 'bien', meh: 'meh' } as const

export function useYear() {
  return useQuery({ queryKey: ['year'], queryFn: api.getYear, staleTime: 10 * 60_000 })
}

/** La tarjeta como imagen (se pide al verla y se guarda en caché). */
export function useYearCard(kind: YearCardKind, enabled: boolean) {
  return useQuery({
    queryKey: ['year-card', kind],
    queryFn: async () => URL.createObjectURL(await api.getYearCard(kind)),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

/** Texto alternativo de cada tarjeta: lo mismo que dibuja la imagen, en palabras. */
export function cardAlt(kind: YearCardKind, s: YearSummary, headline: string): string {
  const rest = (() => {
    switch (kind) {
      case 'intro':
        return `${s.totals.sessions} entrevistas, ${s.totals.recommended} recomendaciones${s.totals.seen ? ` y ${s.totals.seen} ya vistos` : ''}.`
      case 'domains':
        return s.domains.map((d) => `${d.name}: ${d.sessions} entrevistas`).join('; ')
      case 'rated':
        return s.topRated.map((r) => `${r.title} (${RATING[r.rating]})`).join('; ')
      case 'creators':
        return s.creators.map((c) => `${c.name}, ${c.count} veces`).join('; ')
      case 'words':
        return s.words.map((w) => w.word).join(', ')
      case 'vibe':
        return (s.vibe?.bars ?? []).map((b) => `${b.label}: ${b.word ?? 'equilibrada'}`).join('; ')
      case 'facts':
        return s.facts.join('. ')
    }
  })()
  return `${headline}. ${rest}`
}

/** Compartir la imagen (Web Share API con archivos) o, si no se puede, descargarla. */
export async function shareImage(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text: title })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}
