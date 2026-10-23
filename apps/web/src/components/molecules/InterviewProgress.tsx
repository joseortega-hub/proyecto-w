import { Dial, Text } from '@/components/atoms'

/** Dial de confianza con su porcentaje: "Te voy conociendo". */
export function InterviewProgress({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  return (
    <div className="flex flex-col gap-1.5">
      <Dial value={confidence} />
      <div className="flex justify-between font-mono text-xs tabular-nums">
        <span className="text-muted-foreground">Te voy conociendo</span>
        <span className="font-semibold text-signal-foreground">{pct} %</span>
      </div>
      <Text className="sr-only" aria-live="polite">
        Confianza del perfil: {pct} %
      </Text>
    </div>
  )
}
