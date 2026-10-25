const NAMES: Record<string, string> = {
  groq: 'Groq',
  laya: 'Laya',
  gemini: 'Gemini',
  cerebras: 'Cerebras',
  openrouter: 'OpenRouter',
  jev: 'Jev',
  'caché': 'Caché',
}
export const providerName = (id: string) => NAMES[id] ?? id

/** Un color por proveedor; el texto sigue usando el color del tema, así que se lee en todos los temas. */
const HUES: Record<string, string> = {
  groq: 'oklch(0.68 0.19 40)',
  laya: 'oklch(0.66 0.15 160)',
  gemini: 'oklch(0.62 0.18 265)',
  cerebras: 'oklch(0.66 0.16 330)',
  openrouter: 'oklch(0.7 0.14 95)',
  jev: 'oklch(0.62 0.15 210)',
  'caché': 'oklch(0.7 0.13 135)',
}
export const providerHue = (id: string) => HUES[id] ?? 'oklch(0.6 0.02 260)'

/** 1234 → "1,2 s"; 340 → "340 ms". */
export const formatMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(ms)} ms`)

export function formatEur(value: number) {
  if (value === 0) return '0 €'
  if (value < 0.01) return `${(value * 100).toFixed(value < 0.0001 ? 3 : 2).replace('.', ',')} cént.`
  return `${value.toFixed(2).replace('.', ',')} €`
}

const TASKS: Record<string, string> = {
  choice: 'Siguiente pregunta',
  score: 'Perfil de ánimo',
  noul: '¿Encaja?',
  'score+noul': 'Perfil y encaje',
  text: 'Texto',
  embedding: 'Embedding',
}
export const taskName = (task: string) => TASKS[task] ?? task
