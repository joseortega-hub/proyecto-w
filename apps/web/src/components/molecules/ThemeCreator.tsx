import { Button, Icon, Spinner, Text, ThemeSwatch } from '@/components/atoms'
import { StartingPointField } from './StartingPointField'
import { cn } from '@/lib/utils'

export type ThemeCreatorStatus = 'idle' | 'loading' | 'ready' | 'error'

type ThemeCreatorProps = {
  description: string
  onDescription: (value: string) => void
  status: ThemeCreatorStatus
  /** Tema propuesto (solo con status "ready"): nombre y muestras del modo actual. */
  proposal?: { label: string; swatches: string[]; notices: string[] }
  error?: string
  /** Falso cuando ya hay 3 temas propios guardados. */
  canSave: boolean
  onGenerate: () => void
  onAnother: () => void
  onSave: () => void
  onDiscard: () => void
  /** Para las historias: fuerza que se vea (o no) el 🎤. */
  speech?: boolean
  className?: string
}

/** Crear un tema con IA: descripción (texto o voz), vista previa ya aplicada y Guardar / Otra versión / Descartar. */
export function ThemeCreator({
  description,
  onDescription,
  status,
  proposal,
  error,
  canSave,
  onGenerate,
  onAnother,
  onSave,
  onDiscard,
  speech,
  className,
}: ThemeCreatorProps) {
  const loading = status === 'loading'
  return (
    <div className={cn('flex flex-col gap-3 px-1 pb-1', className)}>
      <StartingPointField
        value={description}
        onChange={onDescription}
        label="Describe tu estilo"
        placeholder="Ej.: neón, reguetón de noche"
        speech={speech}
        hint="No guardo lo que escribes ni tu voz: solo lo uso para crear el tema."
      />
      {status !== 'ready' && (
        <Button size="md" block onClick={onGenerate} disabled={loading || description.trim().length < 2}>
          {loading ? <Spinner label="Creando el tema" className="text-primary-foreground" /> : <Icon name="sparkles" className="size-4" />}
          {loading ? 'Creando…' : 'Crear tema'}
        </Button>
      )}
      {status === 'error' && (
        <Text size="sm" role="alert" className="text-destructive">
          {error ?? 'No he podido crear el tema. Prueba otra vez.'}
        </Text>
      )}
      {status === 'ready' && proposal && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3" aria-live="polite">
          <div className="flex items-center gap-3">
            <ThemeSwatch colors={proposal.swatches} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-bold">{proposal.label}</span>
              <span className="text-xs text-muted-foreground">Ya lo ves aplicado: pruébalo antes de guardar.</span>
            </div>
          </div>
          {proposal.notices.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
              {proposal.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {!canSave && <Text size="xs" tone="muted">Ya tienes 3 temas propios: borra uno del menú para guardar este.</Text>}
          <div className="grid grid-cols-2 gap-2">
            <Button size="md" onClick={onSave} disabled={!canSave}>
              <Icon name="check" className="size-4" />
              Guardar
            </Button>
            <Button size="md" variant="secondary" onClick={onAnother} disabled={loading}>
              {loading ? <Spinner label="Creando otra versión" /> : <Icon name="retry" className="size-4" />}
              Otra versión
            </Button>
          </div>
          <Button size="md" variant="ghost" block onClick={onDiscard}>
            Descartar
          </Button>
        </div>
      )}
    </div>
  )
}
