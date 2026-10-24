import { Meter, Spinner, Text } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface ImportProgressProps {
  /** Paso actual en palabras ("Analizando tus canciones con IA (24/180)"). */
  step: string
  found: number
  analyzed: number
  embedded: number
  /** Si ya terminó, no se muestra el spinner. */
  running: boolean
  className?: string
}

/** Progreso de la importación de la música de YouTube: lectura → análisis con IA → embeddings. */
export function ImportProgress({ step, found, analyzed, embedded, running, className }: ImportProgressProps) {
  // Tres fases con el mismo peso: leer la biblioteca, analizar y vectorizar.
  const fraction = /(\d+)\/(\d+)/.exec(step)
  const phase = /búsqueda semántica/i.test(step) ? 2 : /analizando/i.test(step) ? 1 : 0
  const within = fraction ? Number(fraction[1]) / Math.max(1, Number(fraction[2])) : 0
  const value = running ? Math.min(0.98, (phase + within) / 3) : 1
  return (
    <div className={cn('flex flex-col gap-2', className)} role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        {running && <Spinner className="size-4 text-domain" />}
        <Text size="sm" className="truncate font-bold">
          {step}
        </Text>
      </div>
      <Meter value={value} label="Progreso de la importación" className="[&>[data-slot=progress-indicator]]:bg-domain" />
      <Text size="xs" tone="muted" font="mono">
        {found} canciones · {analyzed} analizadas con IA · {embedded} con embedding
      </Text>
    </div>
  )
}
