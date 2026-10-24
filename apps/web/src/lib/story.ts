// «Tu historia»: el calendario de vibras (pura) y el hook que carga los datos de la persona.
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { StoryDay } from './home-types'
import { vibeGradient } from './vibe/vibe-color'
import { vibeSpec } from './vibe/vibe-spec'
import { vibeTitle } from './vibe/vibe-title'

export function useStory() {
  return useQuery({ queryKey: ['story'], queryFn: api.getStory, staleTime: 60_000 })
}

/** Día local como «2026-10-24» (no UTC: la persona piensa en su día). */
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export interface CalendarCell {
  key: string
  date: Date
  future: boolean
  /** Última lista de ese día con perfil, con su vibra y color ya calculados. */
  day: (StoryDay & { emoji: string; text: string; from: string; to: string; gradient: string }) | null
  /** Listas de ese día (la última manda en el color). */
  count: number
}

/**
 * Cuadrícula tipo GitHub: `weeks` columnas de lunes a domingo que acaban en la semana de `now`.
 * Cada día con listas lleva la vibra de la última (nombre y degradado con el motor compartido).
 */
export function buildCalendar(days: StoryDay[], now = new Date(), weeks = 16): CalendarCell[] {
  const byDay = new Map<string, StoryDay[]>()
  for (const d of [...days].sort((a, b) => a.at.localeCompare(b.at))) {
    const k = dayKey(new Date(d.at))
    byDay.set(k, [...(byDay.get(k) ?? []), d])
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Lunes de la semana actual (domingo = 0 en JS).
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const start = new Date(monday)
  start.setDate(monday.getDate() - 7 * (weeks - 1))
  const cells: CalendarCell[] = []
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const key = dayKey(date)
    const list = byDay.get(key) ?? []
    const last = list.at(-1)
    let day: CalendarCell['day'] = null
    if (last) {
      const spec = vibeSpec(last.domainId)
      const title = vibeTitle(last.domainId, last.scales, last.context)
      const g = vibeGradient(last.scales[spec.axes.drive] ?? 0.5, last.scales[spec.axes.mood] ?? 0.5)
      day = { ...last, emoji: title.emoji, text: title.text, from: g.from, to: g.to, gradient: g.css }
    }
    cells.push({ key, date, future: date > today, day, count: list.length })
  }
  return cells
}

/** Días seguidos con alguna lista, contando hacia atrás desde hoy (o desde ayer si hoy aún no hay). */
export function currentStreak(cells: CalendarCell[]): number {
  const past = cells.filter((c) => !c.future)
  let i = past.length - 1
  if (i >= 0 && !past[i].day) i -= 1
  let streak = 0
  for (; i >= 0 && past[i].day; i--) streak += 1
  return streak
}
