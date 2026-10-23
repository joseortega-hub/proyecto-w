import { useId, useRef } from 'react'
import { MicButton, Text } from '@/components/atoms'
import { useSpeech } from '@/lib/speech'
import { cn } from '@/lib/utils'

interface StartingPointFieldProps {
  value: string
  onChange: (value: string) => void
  /** "¿Cómo estás o qué te apetece jugar?" */
  label: string
  placeholder?: string
  /** Para las historias: fuerza que se vea (o no) el 🎤 sin depender del navegador. */
  speech?: boolean
  /** Nota bajo el campo; por defecto, la de privacidad. */
  hint?: string
  className?: string
}

const MAX = 500

/**
 * Punto de partida opcional: la persona escribe (o dicta) cómo está o qué le apetece.
 * Si el navegador no tiene reconocimiento de voz, el 🎤 no aparece.
 */
export function StartingPointField({
  value,
  onChange,
  label,
  placeholder,
  speech,
  hint = 'Opcional. No guardo lo que escribes ni tu voz: solo lo uso para afinar las preguntas.',
  className,
}: StartingPointFieldProps) {
  const id = useId()
  // Lo dictado se añade a lo que hubiera escrito al empezar a dictar.
  const before = useRef('')
  const dictation = useSpeech((text) => onChange([before.current, text].filter(Boolean).join(' ').slice(0, MAX)))
  const startDictation = () => {
    before.current = value.trim()
    dictation.start()
  }
  const showMic = speech ?? dictation.supported

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="label-caps">
        {label}
      </label>
      <div className="flex items-start gap-2 rounded-[14px] border-[1.5px] border-border bg-card p-2 focus-within:border-domain">
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX))}
          placeholder={placeholder}
          rows={2}
          maxLength={MAX}
          className="min-h-11 flex-1 resize-none bg-transparent px-1.5 py-2 text-base outline-none placeholder:text-muted-foreground"
        />
        {showMic && (
          <MicButton listening={dictation.listening} onClick={dictation.listening ? dictation.stop : startDictation} />
        )}
      </div>
      <Text tone="muted" size="xs" role={dictation.error ? 'alert' : undefined}>
        {dictation.listening
          ? 'Te escucho…'
          : (dictation.error ?? hint)}
      </Text>
    </div>
  )
}
