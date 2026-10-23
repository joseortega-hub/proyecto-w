// Persona anónima: un id que se genera en este navegador y se guarda en él. Sin registro.
// Con él, la API recuerda los gustos de cada temática; borrarlo es empezar de cero.
const KEY = 'sintonia:usuario'
let memory: string | undefined

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
      )

export function userId(): string {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored) return stored
    const id = newId()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    // Sin almacenamiento (modo privado): vale para esta visita.
    memory ??= newId()
    return memory
  }
}

/** Cabecera con la que la API identifica a la persona anónima. */
export const userHeaders = () => ({ 'x-sintonia-user': userId() })
