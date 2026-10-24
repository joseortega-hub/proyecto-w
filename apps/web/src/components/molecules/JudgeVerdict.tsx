import { Meter, Text } from '@/components/atoms'
import { providerName } from '@/lib/ops-format'

/** Veredicto del LLM juez: nota de 1 a 5 y una frase de motivo. */
export function JudgeVerdict({ score, reason, judge }: { score: number; reason: string; judge: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3" role="status">
      <div className="flex items-baseline justify-between">
        <Text font="mono" className="text-xl font-bold">
          {score}/5
        </Text>
        <Text size="xs" tone="muted">
          Juez: {providerName(judge)}
        </Text>
      </div>
      <Meter value={score / 5} label={`Coherencia ${score} de 5`} />
      <Text size="sm">{reason}</Text>
    </div>
  )
}
