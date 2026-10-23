export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return '0:00'
  const s = Math.floor(seconds)
  // Películas: "2 h 22 min" en vez de "142:00".
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')} min`
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function totalMinutes(durations: (number | null)[]) {
  return Math.round(durations.reduce<number>((a, d) => a + (d ?? 0), 0) / 60)
}

const decimal = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const formatScore = (n: number) => decimal.format(n)

const integer = new Intl.NumberFormat('es-ES')
export const formatInt = (n: number) => integer.format(n)

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
export function timeAgo(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000)
  if (days === 0) {
    const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000)
    return relative.format(hours, 'hour')
  }
  return relative.format(days, 'day')
}
