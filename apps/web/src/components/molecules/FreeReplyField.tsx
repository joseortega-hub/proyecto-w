import { useId, useRef, useState } from 'react'
import { IconButton, MicButton, Text } from '@/components/atoms'
import { useSpeech } from '@/lib/speech'
import { cn } from '@/lib/utils'

const MAX = 300

interface FreeReplyFieldProps {
  /** Envía la respuesta escrita o dictada ("no, más romántico", "eso no tiene sentido"). */
  onSend: (text: string) => void
  disabled?: boolean
  /** Para las historias: fuerza que se vea (o no) el 🎤 sin depender del navegador. */
  speech?: boolean
  className?: string
}

/** Respuesta libre bajo el Sí / No: escribir o dictar para guiar o corregir la entrevista. */
export function FreeReplyField({ onSend, disabled, speech, className }: FreeReplyFieldProps) {
  const id = useId()
  const [value, setValue] = useState('')
  const before = useRef('')
  const dictation = useSpeech((text) => setValue([before.current, text].filter(Boolean).join(' ').slice(0, MAX)))
  const showMic = speech ?? dictation.supported
  const send = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
  }

  return (
    <form
      className={cn('flex flex-col gap-1', className)}
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      <label htmlFor={id} className="sr-only">
        O dímelo con tus palabras
      </label>
      <div className="flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-card py-1 pl-4 pr-1 focus-within:border-domain">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, MAX))}
          placeholder="O dímelo a tu manera: «más romántico»…"
          maxLength={MAX}
          disabled={disabled}
          enterKeyHint="send"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        {showMic && (
          <MicButton
            listening={dictation.listening}
            disabled={disabled}
            onClick={() => {
              if (dictation.listening) return dictation.stop()
              before.current = value.trim()
              dictation.start()
            }}
          />
        )}
        <IconButton icon="send" label="Enviar respuesta" type="submit" disabled={disabled || !value.trim()} />
      </div>
      {(dictation.listening || dictation.error) && (
        <Text tone="muted" size="xs" role={dictation.error ? 'alert' : undefined}>
          {dictation.listening ? 'Te escucho…' : dictation.error}
        </Text>
      )}
    </form>
  )
}
