// Dictado con la Web Speech API (Chrome, Edge, Chrome Android; parcial en Safari iOS; no en
// Firefox). Si no existe, `supported` es false y la UI oculta el 🎤. El audio no sale del
// navegador hacia Sintonía: solo se usa el texto transcrito, y tampoco se guarda.
import { useCallback, useEffect, useRef, useState } from 'react'

interface RecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
}

interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: RecognitionResultEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

type RecognitionCtor = new () => Recognition

const recognitionCtor = (): RecognitionCtor | undefined => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const speechSupported = () => !!recognitionCtor()

/**
 * Dicta en español. `onText` recibe el texto acumulado de este dictado (provisional
 * mientras se habla y definitivo al terminar).
 */
export function useSpeech(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string>()
  const recognition = useRef<Recognition | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  useEffect(() => () => recognition.current?.abort(), [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor || recognition.current) return
    const r = new Ctor()
    r.lang = 'es-ES'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()
      onTextRef.current(text)
    }
    r.onerror = (e) => {
      setError(e.error === 'not-allowed' ? 'Sin permiso para usar el micrófono' : 'No te he entendido; prueba otra vez')
    }
    r.onend = () => {
      recognition.current = null
      setListening(false)
    }
    setError(undefined)
    recognition.current = r
    setListening(true)
    r.start()
  }, [])

  const stop = useCallback(() => recognition.current?.stop(), [])

  return { supported: speechSupported(), listening, error, start, stop }
}
