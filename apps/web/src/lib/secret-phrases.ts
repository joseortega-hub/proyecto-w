// Gancho para frases secretas de la barra universal de «Hoy para ti».
//
// Antes de llamar a `POST /api/route-intent`, la barra pregunta aquí si lo escrito es una frase
// secreta. Hoy son las del Modo Perreo (solo hashes): si no coincide, devuelve `null` y la barra sigue su
// camino normal.
//
// Cómo añadir una frase (contrato para quien lo implemente):
//  - Normaliza el texto con `normalizePhrase` (minúsculas, sin tildes ni signos, espacios simples).
//  - Compara su hash SHA-256 (`hashPhrase`) con una lista de hashes: las frases NO deben aparecer
//    en el código, solo sus hashes. Así nadie puede leerlas en el bundle.
//  - Si coincide, devuelve un `SecretMatch`; la barra llama a `activate` y NO llama a la API ni
//    guarda el texto. Si no coincide, devuelve `null`.
//  - Debe ser rápida y no hacer red: se ejecuta en cada envío.
import type { NavigateFunction } from 'react-router'
import { prettyNickname, saveUnlock } from './perreo'

export interface SecretMatch {
  /** Identificador interno del modo desbloqueado (p. ej. `perreo`). */
  id: string
  /** Qué hace al desbloquearse: navegar, activar un tema, etc. */
  activate: (ctx: { navigate: NavigateFunction }) => void
}

/** Minúsculas, sin tildes ni signos y con espacios simples: «¡Dale Mami!» → «dale mami». */
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
 * Hash SHA-256 de cada frase normalizada → artista del Modo Perreo. Las frases no están en el
 * código ni en la API: solo estos hashes (y el nombre del artista, que es público).
 */
export const PERREO_HASHES: Record<string, string> = {
  '4840ed95ff3f67dbf06b5292d4dc5cb70cc3151868c1dfb12922b8867af3e805': 'wisin',
  '53d3618b19e6c1f63367c9e4764023b012aaf7ad6d3bd21480867a3c751270f0': 'yandel',
  '5122aae96cede421fd8e967a7f1c7b1376012c93cd0cc0107c7207fa5d25b9b1': 'arcangel',
  '1dc2eaa8e86ccdf97c6af03cdf059c5693b8fb2bcbd160ece27329633c5fe351': 'farruko',
  '88d9a797d4f5b7017da8e92c58f9c1c1bae9ac8769bf6f302d3e31ef03382163': 'jay-wheeler',
}

/**
 * ¿Es `text` una frase secreta? Si coincide, guarda el desbloqueo (artista y apodo tal como se
 * escribió) y lleva al homenaje. El texto no sale del navegador, no va a la API y no se registra.
 */
export async function matchSecretPhrase(text: string): Promise<SecretMatch | null> {
  const hash = await hashPhrase(text)
  const slug = hash ? PERREO_HASHES[hash] : undefined
  if (!slug) return null
  return {
    id: 'perreo',
    activate: ({ navigate }) => {
      saveUnlock({ slug, nickname: prettyNickname(text) })
      navigate(`/perreo/homenaje/${slug}`, { state: { fresh: true } })
    },
  }
}
