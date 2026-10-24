const FLAGS: Record<string, string> = {
  'puerto rico': '🇵🇷',
  colombia: '🇨🇴',
  'republica dominicana': '🇩🇴',
  panama: '🇵🇦',
  'estados unidos': '🇺🇸',
  espana: '🇪🇸',
  mexico: '🇲🇽',
  venezuela: '🇻🇪',
  cuba: '🇨🇺',
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/** Bandera de un país (vacío si no se conoce). */
export const flagOf = (country: string) => FLAGS[fold(country)] ?? '🌎'

/** «underground» … «mainstream» según la fama 0–100. */
export function fameLabel(fame: number): string {
  if (fame >= 80) return 'Mainstream'
  if (fame >= 55) return 'Muy conocido'
  if (fame >= 30) return 'Conocido'
  if (fame >= 10) return 'De culto'
  return 'Underground'
}

/** Años de carrera desde el debut. */
export const careerYears = (debutYear: number | null, now = new Date().getFullYear()) => (debutYear ? Math.max(0, now - debutYear) : null)

/** «Puerto Rico / Estados Unidos» → «Puerto Rico y Estados Unidos»; con ciudad: «San Juan, Puerto Rico». */
export function originLabel(city: string | null, countries: string[]): string {
  const place = city?.split('/')[0]?.split(',')[0]?.trim()
  const country = countries.join(' y ')
  return [place, country].filter(Boolean).join(', ')
}

/** Iniciales para la foto que falta. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

/** Años de un sello: «1992–1996», «2001–hoy», «2014». */
export function labelYears(start: number | null, end: number | null): string {
  if (!start && !end) return ''
  if (start && end && start !== end) return `${start}–${end}`
  if (start && !end) return `${start}–hoy`
  return String(start ?? end)
}

export const LINK_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  youtubeMusic: 'YouTube Music',
  appleMusic: 'Apple Music',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  x: 'X',
  web: 'Web oficial',
}
