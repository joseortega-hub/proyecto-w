// Gancho para frases secretas de la barra universal de «Hoy para ti».
//
// Antes de llamar a `POST /api/route-intent`, la barra pregunta aquí si lo escrito es una frase
// secreta. Hoy no hay ninguna: `matchSecretPhrase` siempre devuelve `null` y la barra sigue su
// camino normal. Una sesión posterior (el «Modo Perreo») rellenará esta función.
//
// Cómo añadir una frase (contrato para quien lo implemente):
//  - Normaliza el texto con `normalizePhrase` (minúsculas, sin tildes ni signos, espacios simples).
//  - Compara su hash SHA-256 (`hashPhrase`) con una lista de hashes: las frases NO deben aparecer
//    en el código, solo sus hashes. Así nadie puede leerlas en el bundle.
//  - Si coincide, devuelve un `SecretMatch`; la barra llama a `activate` y NO llama a la API ni
//    guarda el texto. Si no coincide, devuelve `null`.
//  - Debe ser rápida y no hacer red: se ejecuta en cada envío.
import type { NavigateFunction } from 'react-router'

export interface SecretMatch {
  /** Identificador interno del modo desbloqueado (p. ej. `perreo`). */
  id: string
  /** Qué hace al desbloquearse: navegar, activar un tema, etc. */
  activate: (ctx: { navigate: NavigateFunction }) => void
}

/** Minúsculas, sin tildes ni signos y con espacios simples: «¡El Matatán!» → «el matatan». */
export function normalizePhrase(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** SHA-256 en hexadecimal de la frase ya normalizada (Web Crypto; null si el navegador no lo tiene). */
export async function hashPhrase(text: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null
  const bytes = new TextEncoder().encode(normalizePhrase(text))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * ¿Es `text` una frase secreta? Gancho vacío a propósito: de momento nada es secreto.
 * El texto no sale del navegador ni se guarda.
 */
export async function matchSecretPhrase(_text: string): Promise<SecretMatch | null> {
  return null
}
