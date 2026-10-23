// Contexto que el navegador aporta a la entrevista: su zona horaria y, solo si la persona
// ya dio permiso de ubicación antes, su posición aproximada. Nunca se pide permiso aquí:
// sin él, la API usa la posición por defecto para el tiempo.
export interface ClientContext {
  timeZone?: string
  latitude?: number
  longitude?: number
}

export interface InterviewContext {
  hora?: string
  franja?: 'madrugada' | 'mañana' | 'mediodía' | 'tarde' | 'noche'
  diaSemana?: string
  finDeSemana?: boolean
  tiempo?: { descripcion: string; temperaturaC: number; esDeDia?: boolean }
}

async function grantedPosition(): Promise<GeolocationPosition | null> {
  try {
    if (!navigator.permissions || !navigator.geolocation) return null
    const status = await navigator.permissions.query({ name: 'geolocation' })
    if (status.state !== 'granted') return null
    return await new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        timeout: 1500,
        maximumAge: 30 * 60_000,
        enableHighAccuracy: false,
      }),
    )
  } catch {
    return null
  }
}

export async function clientContext(): Promise<ClientContext> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const position = await grantedPosition()
  // Unos 10 km de precisión bastan para saber si llueve.
  const round = (n: number) => Math.round(n * 10) / 10
  return position
    ? { timeZone, latitude: round(position.coords.latitude), longitude: round(position.coords.longitude) }
    : { timeZone }
}
