import { Heading, Text } from '@/components/atoms'
import { IntentChips, UniversalBar, type IntentChoice } from '@/components/molecules'
import type { InterviewContext } from '@/lib/context'
import { greetingGradient, greetingLine } from '@/lib/greeting'

interface TodayHeroProps {
  context: InterviewContext
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  busy?: boolean
  speech?: boolean
  /** Opciones cuando la barra no tiene clara la temática. */
  choices?: IntentChoice[]
  /** Mensaje sobre los chips (p. ej. el de error). */
  choicesMessage?: string
  onPick: (domainId: string) => void
}

/**
 * Lo primero que se ve: el saludo con el contexto sobre un degradado según la hora y el
 * tiempo (tinta oscura con contraste AA garantizado) y la barra «¿Qué te apetece?».
 * La barra y los chips usan el tema elegido; solo el fondo del saludo es propio.
 */
export function TodayHero({ context, value, onChange, onSubmit, busy, speech, choices, choicesMessage, onPick }: TodayHeroProps) {
  const gradient = greetingGradient(context)
  return (
    <section
      aria-labelledby="today-heading"
      style={{ backgroundImage: gradient.css, color: gradient.ink }}
      className="flex flex-col gap-4 rounded-[22px] p-5 shadow-sm md:p-8"
    >
      <Text font="label" className="text-[13px]" style={{ color: gradient.ink }}>
        {greetingLine(context)}
      </Text>
      <Heading as="h1" size="display" id="today-heading">
        ¿Qué te apetece?
      </Heading>
      <UniversalBar value={value} onChange={onChange} onSubmit={onSubmit} busy={busy} speech={speech} />
      {choices && choices.length > 0 && (
        <div className="rounded-[14px] bg-card p-3 text-foreground">
          <IntentChips choices={choices} onPick={onPick} message={choicesMessage} />
        </div>
      )}
    </section>
  )
}
