import { useId, useRef } from 'react'
import { IconButton, MicButton, Spinner } from '@/components/atoms'
import { useSpeech } from '@/lib/speech'
import { cn } from '@/lib/utils'

interface UniversalBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  /** Detectando la temática. */
  busy?: boolean
  /** Para las historias: fuerza que se vea (o no) el 🎤 sin depender del navegador. */
  speech?: boolean
  placeholder?: string
  className?: string
}

const MAX = 300

/**
 * La barra «¿Qué te apetece?»: texto o voz, una sola línea. Al enviar, la main detecta la
 * temática. Lo que se escribe es un dato: no se guarda.
 */
export function UniversalBar({ value, onChange, onSubmit, busy, speech, placeholder = 'Algo de Marvel, reguetón para entrenar, un juego tipo Pokémon…', className }: UniversalBarProps) {
  const id = useId()
  const before = useRef('')
  const dictation = useSpeech((text) => onChange([before.current, text].filter(Boolean).join(' ').slice(0, MAX)))
  const startDictation = () => {
    before.current = value.trim()
    dictation.start()
  }
  const showMic = speech ?? dictation.supported

  return (
    <form
      role="search"
      className={cn('flex items-center gap-2 rounded-full border-[1.5px] border-border bg-card p-1.5 pl-4 shadow-sm focus-within:border-domain', className)}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <label htmlFor={id} className="sr-only">
        ¿Qué te apetece?
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={MAX}
        enterKeyHint="send"
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
      />
      {showMic && <MicButton listening={dictation.listening} onClick={dictation.listening ? dictation.stop : startDictation} />}
      {busy ? (
        <span className="grid size-11 flex-none place-items-center text-muted-foreground">
          <Spinner />
        </span>
      ) : (
        <IconButton type="submit" icon="send" variant="primary" label="Buscar lo que me apetece" disabled={!value.trim()} />
      )}
    </form>
  )
}
