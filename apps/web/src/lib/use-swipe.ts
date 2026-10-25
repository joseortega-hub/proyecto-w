// «Desliza» en el resultado: cada gesto toca la lista y el perfil de gustos, y la pila pide más parecidas al acabarse.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type Feedback, type ResultEntry } from './api'
import { EMPTY_SWIPE, freshExtras, loadSwipeState, nextSeeds, pile, pushStep, saveSwipeState, type SwipeState, type Verdict } from './swipe'

/** Con tan pocas tarjetas por delante se piden más parecidas. */
const REFILL_AT = 2
/** Topes para que la pila no crezca sin fin ni lance peticiones de más. */
const MAX_EXTRAS = 40
const MAX_SEEDS = 8
const PER_SEED = 12

interface Options {
  sessionId: string
  entries: ResultEntry[]
  /** 👍/👎 guardados en el perfil de gustos. */
  feedback: Record<string, Feedback>
  sendFeedback: (itemId: string, value: Feedback | null) => void
  updateEntries: (entries: ResultEntry[]) => void
  /** Solo pide más parecidas con el modo Desliza a la vista. */
  enabled: boolean
}

export function useSwipeSession({ sessionId, entries, feedback, sendFeedback, updateEntries, enabled }: Options) {
  const [state, setState] = useState<SwipeState>(() => loadSwipeState(sessionId))
  const [loading, setLoading] = useState(false)
  useEffect(() => saveSwipeState(sessionId, state), [sessionId, state])

  const cards = useMemo(() => pile(entries, state), [entries, state])
  const last = state.steps.at(-1) ?? null

  const decide = useCallback(
    (verdict: Verdict, entry: ResultEntry) => {
      const id = entry.item.id
      const previous = feedback[id] ?? null
      const present = entries.some((e) => e.item.id === id)
      let before: ResultEntry[] | null = null
      if (verdict === 'like' && !present) {
        before = entries
        updateEntries([...entries, entry])
      } else if (verdict === 'nope' && present && entries.length > 1) {
        before = entries
        updateEntries(entries.filter((e) => e.item.id !== id))
      }
      const value: Feedback = verdict === 'like' ? 'up' : 'down'
      if (previous !== value) sendFeedback(id, value)
      setState((s) => pushStep(s, { itemId: id, verdict, previous, before }))
    },
    [entries, feedback, sendFeedback, updateEntries],
  )

  const undo = useCallback(() => {
    if (!last) return
    if (last.before) updateEntries(last.before)
    const value: Feedback = last.verdict === 'like' ? 'up' : 'down'
    if (last.previous !== value) sendFeedback(last.itemId, last.previous)
    setState((s) => ({ ...s, steps: s.steps.slice(0, -1) }))
  }, [last, sendFeedback, updateEntries])

  const restart = useCallback(() => setState(EMPTY_SWIPE), [])

  // Pila casi vacía: más parecidas (vecinos por embedding, sin IA) a lo último que ha gustado.
  const busy = useRef(false)
  const seeds = state.seeds.length < MAX_SEEDS && state.extras.length < MAX_EXTRAS ? nextSeeds(entries, state) : []
  const exhausted = !seeds.length
  const seedKey = seeds.join(',')
  useEffect(() => {
    if (!enabled || busy.current || cards.length > REFILL_AT || !seedKey) return
    const ids = seedKey.split(',')
    const known = new Map([...entries, ...state.extras].map((e) => [e.item.id, e.item.title]))
    const liked = new Set(state.steps.filter((s) => s.verdict === 'like').map((s) => s.itemId))
    busy.current = true
    setLoading(true)
    Promise.all(
      ids.map((seed) =>
        api.getSimilar(seed, PER_SEED).then(
          (r) =>
            r.items.map(({ similarity, item }): ResultEntry => ({
              item,
              match: Math.round(similarity * 100),
              fit: null,
              reason: `Se parece a «${known.get(seed) ?? 'lo anterior'}»${liked.has(seed) ? ', que te ha gustado' : ''}.`,
            })),
          () => [] as ResultEntry[],
        ),
      ),
    )
      .then((found) =>
        setState((s) => ({ ...s, seeds: [...s.seeds, ...ids], extras: [...s.extras, ...freshExtras(found.flat(), entries, s, feedback)].slice(0, MAX_EXTRAS) })),
      )
      .finally(() => {
        busy.current = false
        setLoading(false)
      })
  }, [enabled, cards.length, seedKey, entries, state.extras, state.steps, feedback])

  return { cards, lastVerdict: last?.verdict ?? null, canUndo: !!last, decide, undo, restart, loading, exhausted }
}
