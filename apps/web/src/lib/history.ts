// Importar historial (Letterboxd, Goodreads, Steam) como «ya visto», por lotes y reanudable.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type HistoryImport } from './api'

export type HistorySource = HistoryImport['source']

/** Fuente de historial de cada temática (música no tiene). */
export const HISTORY_SOURCE: Record<string, HistorySource> = { movies: 'letterboxd', books: 'goodreads', games: 'steam' }

export const SOURCE_NAMES: Record<HistorySource, string> = { letterboxd: 'Letterboxd', goodreads: 'Goodreads', steam: 'Steam' }

/** Igual que el límite de la API (`CSV_LIMIT`). */
export const MAX_CSV_BYTES = 5 * 1024 * 1024

/** Comprueba el archivo antes de subirlo: CSV y como mucho 5 MB. Null si vale. */
export function csvProblem(file: { name: string; size: number }): string | null {
  if (!/\.csv$/i.test(file.name)) return 'Tiene que ser un archivo .csv'
  if (file.size === 0) return 'El archivo está vacío'
  if (file.size > MAX_CSV_BYTES) return 'El archivo pasa de 5 MB: divídelo en dos y súbelos por separado'
  return null
}

/** «312 películas importadas, 280 encontradas, 32 sin encontrar». */
export function importSummary(view: Pick<HistoryImport, 'processed' | 'found' | 'notFound'>, nounPlural: string, foundWord = 'encontradas'): string {
  return `${view.processed} ${nounPlural} importad${foundWord.endsWith('as') ? 'as' : 'os'}, ${view.found} ${foundWord}, ${view.notFound} sin encontrar`
}

/** Fracción hecha (0–1). */
export const importProgress = (view: Pick<HistoryImport, 'processed' | 'total'>) => (view.total ? Math.min(1, view.processed / view.total) : 0)

/**
 * La importación de una temática: se arranca con un CSV o un perfil de Steam y se van pidiendo
 * lotes mientras la pantalla está abierta. Si se cierra a medias, al volver se puede continuar.
 */
export function useHistoryImport(domainId: string) {
  const queryClient = useQueryClient()
  const latest = useQuery({ queryKey: ['history', domainId], queryFn: () => api.getHistoryImport(domainId), enabled: !!HISTORY_SOURCE[domainId] })
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const loop = useCallback(
    async (start: HistoryImport) => {
      setRunning(true)
      setError(null)
      let view = start
      queryClient.setQueryData(['history', domainId], view)
      try {
        while (view.status === 'running' && alive.current) {
          view = await api.stepHistory(view.id)
          queryClient.setQueryData(['history', domainId], view)
        }
        if (view.status === 'done') void queryClient.invalidateQueries({ queryKey: ['seen', domainId] })
      } catch (e) {
        setError((e as Error).message)
      } finally {
        if (alive.current) setRunning(false)
      }
    },
    [domainId, queryClient],
  )

  const start = useCallback(
    async (input: { csv: string } | { steam: string }) => {
      setError(null)
      setRunning(true)
      try {
        const view = 'csv' in input ? await api.startHistoryCsv(domainId, input.csv) : await api.startHistorySteam(domainId, input.steam)
        await loop(view)
      } catch (e) {
        setError((e as Error).message)
        setRunning(false)
      }
    },
    [domainId, loop],
  )

  const resume = useCallback(() => latest.data && loop(latest.data), [latest.data, loop])

  return { view: latest.data ?? null, loading: latest.isPending, running, error, start, resume }
}
