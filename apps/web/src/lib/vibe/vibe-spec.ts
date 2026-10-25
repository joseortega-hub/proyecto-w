/** Cómo se ve y se nombra "Tu vibra" en cada temática. Los dominios personales usan el de música. */
export type VibeVariant = 'eq' | 'hud' | 'cine' | 'book'

export type Level = 'lo' | 'mid' | 'hi'

export interface VibeSpec {
  variant: VibeVariant
  /** Atributos que mandan en el título y el degradado: empuje (intensidad/croma) y ánimo (tono). */
  axes: { drive: string; mood: string }
  /** `titles[drive][mood]`; `{Dia}` se sustituye por el día de la semana. */
  titles: Record<Level, [string, string, string]>
  /** Con lluvia y poca intensidad, el título pasa a este. */
  rainy: string
}

const music: VibeSpec = {
  variant: 'eq',
  axes: { drive: 'energy', mood: 'positivity' },
  titles: {
    lo: ['☔ Tarde de nostalgia', '🌙 Noche tranquila', '☀️ Domingo de sofá y sonrisa'],
    mid: ['🌧️ Nostalgia con ritmo', '🎧 Música de fondo', '😎 Buen ánimo sin prisa'],
    hi: ['⚡ Rabia con ritmo', '🏃 Ganas de movimiento', '🔥 {Dia} con toda la energía'],
  },
  rainy: '☔ Lluvia y cascos puestos',
}

const SPECS: Record<string, VibeSpec> = {
  music,
  youtube: music,
  folder: music,
  games: {
    variant: 'hud',
    axes: { drive: 'intensity', mood: 'lightness' },
    titles: {
      lo: ['🕯️ Rincón oscuro y tranquilo', '🧘 Calma con mando', '🌱 Sofá y calma'],
      mid: ['🗡️ Aventura con sombras', '🎮 Partida sin prisa', '🧭 Exploración con sonrisa'],
      hi: ['💀 Modo supervivencia', '⚔️ Hoy toca pelea', '🔥 {Dia} de juego intenso'],
    },
    rainy: '☔ Mando y lluvia',
  },
  movies: {
    variant: 'cine',
    axes: { drive: 'pace', mood: 'mood' },
    titles: {
      lo: ['🌑 Drama con paraguas', '🍷 Noche de cine pausado', '🌤️ Peli de manta y calma'],
      mid: ['🕵️ Intriga con sombra', '🍿 Peli de sofá', '😄 Cine de buen humor'],
      hi: ['🔪 Adrenalina oscura', '🎬 Ritmo de estreno', '🎢 {Dia} de montaña rusa'],
    },
    rainy: '☔ Peli de tarde de lluvia',
  },
  books: {
    variant: 'book',
    axes: { drive: 'pace', mood: 'mood' },
    titles: {
      lo: ['🕯️ Lectura a media luz', '📖 Página a página con calma', '☕ Café y novela suave'],
      mid: ['🌫️ Misterio entre líneas', '📚 Lectura de fondo', '🌻 Libro de buen ánimo'],
      hi: ['🗝️ Devoralibros a oscuras', '⚡ Pasapáginas', '🚀 {Dia} sin soltar el libro'],
    },
    rainy: '☔ Libro y ventana mojada',
  },
}

export const vibeSpec = (domainId: string): VibeSpec => SPECS[domainId] ?? music

export const levelOf = (v: number): Level => (v < 0.38 ? 'lo' : v > 0.62 ? 'hi' : 'mid')
