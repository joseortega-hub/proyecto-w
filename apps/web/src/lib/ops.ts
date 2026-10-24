// "Bajo el capó": trazas de IA, comparativa de proveedores y juez. Solo metadatos.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { api } from './api'
import type { CompareResult, Judgement, OpsPanel, TraceRow } from './ops-types'

const SESSION_KEY = 'sintonia.lastSession'
const DEMO_KEY = 'sintonia.demoMode'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Sin almacenamiento (modo privado): el panel simplemente no recuerda.
  }
}

/** La última entrevista de este navegador: la que enseña el panel. */
export const rememberSession = (id: string) => write(SESSION_KEY, id)
export const lastSession = () => read(SESSION_KEY)

const listeners = new Set<() => void>()
const demoSnapshot = () => read(DEMO_KEY) === '1'
/** Modo demo: panel lateral con las decisiones de la IA en directo durante la entrevista. */
export function useDemoMode() {
  const on = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    demoSnapshot,
    () => false,
  )
  const set = useCallback((next: boolean) => {
    write(DEMO_KEY, next ? '1' : null)
    listeners.forEach((l) => l())
  }, [])
  return [on, set] as const
}

export function useOpsPanel(sessionId: string | null) {
  return useQuery({ queryKey: ['ops-panel', sessionId], queryFn: () => api.opsPanel(sessionId), staleTime: 0 })
}

/** Sondeo ligero (1,5 s) de las trazas nuevas de una sesión; se acumulan sin repetirse. */
export function useLiveTraces(sessionId: string | undefined, enabled: boolean): TraceRow[] {
  const [rows, setRows] = useState<TraceRow[]>([])
  const since = useRef<string | undefined>(undefined)
  useEffect(() => {
    setRows([])
    since.current = undefined
    if (!enabled || !sessionId) return
    let stop = false
    const tick = async () => {
      try {
        const { rows: fresh } = await api.opsTraces(sessionId, since.current)
        if (stop || !fresh.length) return
        since.current = fresh[fresh.length - 1].at
        setRows((old) => [...old, ...fresh.filter((f) => !old.some((o) => o.id === f.id))])
      } catch {
        // El sondeo es decorativo: si falla, se reintenta en el siguiente ciclo.
      }
    }
    void tick()
    const timer = setInterval(() => void tick(), 1500)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [sessionId, enabled])
  return rows
}

export function useCompare(sessionId: string | null) {
  const queryClient = useQueryClient()
  return useMutation<CompareResult, Error>({
    mutationFn: () => api.opsCompare(sessionId!),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['ops-panel', sessionId] }),
  })
}

export function useJudge(sessionId: string | null) {
  return useMutation<Judgement, Error>({ mutationFn: () => api.opsJudge(sessionId!) })
}

export type { OpsPanel }
