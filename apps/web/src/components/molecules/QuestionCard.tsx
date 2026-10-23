import { Heading, Skeleton, Text } from '@/components/atoms'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface QuestionCardProps {
  question?: string
  reason?: string
  loading?: boolean
  /** En móvil la pregunta va sin tarjeta; en escritorio, dentro de una. */
  framed?: boolean
}

/** La pregunta actual y por qué la hace el motor ahora. */
export function QuestionCard({ question, reason, loading, framed = false }: QuestionCardProps) {
  const body = loading ? (
    <div className="flex flex-col gap-3" aria-busy aria-label="Pensando la siguiente pregunta">
      <Skeleton className="h-9 w-11/12" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="mt-2 h-5 w-4/5" />
    </div>
  ) : (
    <div className="flex flex-col gap-3.5">
      <Heading size="question" aria-live="polite">
        {question}
      </Heading>
      {reason && (
        <Text tone="muted" size="sm" className="border-l-[3px] border-signal pl-2.5 text-[15px]">
          {reason}
        </Text>
      )}
    </div>
  )
  if (!framed) return body
  return <Card className={cn('gap-0 rounded-lg border-border p-8 shadow-md')}>{body}</Card>
}
