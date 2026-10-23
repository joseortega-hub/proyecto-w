import { Button, Chip, Heading, Text } from '@/components/atoms'
import { AnswerPair, QuestionCard } from '@/components/molecules'
import type { Answer } from '@/lib/api'

interface InterviewPanelProps {
  question: { text: string; reason: string; guess: string } | null
  chips: string[]
  thinking: boolean
  onAnswer: (answer: Answer) => void
  onFinish: () => void
  onRestart: () => void
  framed?: boolean
}

/** Pregunta + lo que ya sabemos + respuestas. Al terminar, el resumen y el paso a la lista. */
export function InterviewPanel({ question, chips, thinking, onAnswer, onFinish, onRestart, framed }: InterviewPanelProps) {
  if (!question && !thinking) {
    return (
      <>
        <div className="flex flex-1 flex-col justify-center gap-3.5">
          <Text font="label">Entrevista completada</Text>
          <Heading size="question">Listo. Ya sé lo que te va a encajar.</Heading>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <Chip key={c}>{c}</Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button block onClick={onFinish}>
            Ver mi lista
          </Button>
          <Button variant="ghost" size="md" block onClick={onRestart}>
            Empezar de nuevo
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex flex-1 flex-col justify-center">
        <QuestionCard question={question?.text} reason={question?.reason} loading={thinking} framed={framed} />
      </div>
      <div className="flex min-h-7 flex-wrap gap-1.5" aria-label="Lo que ya sé de ti">
        {chips.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
        {question && !thinking && <Chip variant="guess">{question.guess}</Chip>}
      </div>
      <AnswerPair onAnswer={onAnswer} disabled={thinking} />
    </>
  )
}
