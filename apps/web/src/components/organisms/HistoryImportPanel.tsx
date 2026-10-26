import { useRef, useState } from 'react'
import { Button, Icon, Meter, Spinner, Text } from '@/components/atoms'
import type { HistoryImport } from '@/lib/api'
import { csvProblem, importProgress, importSummary, SOURCE_NAMES, type HistorySource } from '@/lib/history'
import { cn } from '@/lib/utils'

const HOW_TO: Record<HistorySource, string> = {
  letterboxd: 'En Letterboxd, ve a Settings → Import & Export → Export your data y descomprime el archivo. Sube ratings.csv para traer también tus notas, o watched.csv.',
  goodreads: 'En Goodreads, ve a My Books → Import and export → Export Library y sube el CSV. Solo se importa lo que tienes como leído.',
  steam: 'Pega la URL de tu perfil de Steam o tu SteamID. Tu perfil y los «Detalles de los juegos» tienen que ser públicos. Cuentan los juegos con al menos una hora jugada.',
}

interface HistoryImportPanelProps {
  source: HistorySource
  /** «películas», «libros»… */
  nounPlural: string
  /** «encontradas» o «encontrados». */
  foundWord: string
  view: HistoryImport | null
  running: boolean
  error?: string | null
  onCsv: (csv: string) => void
  onSteam: (profile: string) => void
  onResume: () => void
  className?: string
}

/** Importar historial: subir el CSV (o el perfil de Steam), progreso por lotes y resumen con lo no encontrado. */
export function HistoryImportPanel({ source, nounPlural, foundWord, view, running, error, onCsv, onSteam, onResume, className }: HistoryImportPanelProps) {
  const input = useRef<HTMLInputElement>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [profile, setProfile] = useState('')
  const name = SOURCE_NAMES[source]
  const paused = view?.status === 'running' && !running

  const pick = async (file?: File) => {
    if (!file) return
    const issue = csvProblem(file)
    setProblem(issue)
    if (!issue) onCsv(await file.text())
    if (input.current) input.current.value = ''
  }

  return (
    <section aria-labelledby="importar-historial" className={cn('flex flex-col gap-3 rounded-[18px] border border-border bg-card p-4', className)}>
      <div className="flex flex-col gap-1">
        <h2 id="importar-historial" className="font-display text-lg font-bold">
          Importar desde {name}
        </h2>
        <Text size="sm" tone="muted">
          {HOW_TO[source]}
        </Text>
      </div>

      {source === 'steam' ? (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            if (profile.trim()) onSteam(profile.trim())
          }}
        >
          <label className="flex min-h-11 flex-1 items-center rounded-md border-[1.5px] border-border bg-background px-3 focus-within:border-ring">
            <span className="sr-only">URL de tu perfil de Steam o SteamID</span>
            <input
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="steamcommunity.com/id/…"
              maxLength={200}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
          </label>
          <Button size="md" type="submit" disabled={running || !profile.trim()}>
            Importar
          </Button>
        </form>
      ) : (
        <>
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
          <Button size="md" variant="secondary" className="self-start" disabled={running} onClick={() => input.current?.click()}>
            <Icon name="folder" /> Elegir el CSV
          </Button>
        </>
      )}
      <Text size="xs" tone="muted">
        {source === 'steam'
          ? 'Usamos la Steam Web API solo para leer tu biblioteca pública. Sintonía no está relacionada con Valve.'
          : 'El archivo se lee en nuestro servidor y no se guarda: solo apuntamos lo que encontramos.'}
      </Text>

      {(problem || error) && (
        <Text size="sm" role="alert" className="text-destructive">
          {problem ?? error}
        </Text>
      )}

      {view && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <div className="flex items-center gap-2">
            {running && <Spinner className="size-4 text-domain" />}
            <Text size="sm" className="font-bold">
              {view.status === 'done' ? 'Importación terminada' : running ? `Buscando en el catálogo (${view.processed}/${view.total})` : `Importación a medias (${view.processed}/${view.total})`}
            </Text>
          </div>
          <Meter value={view.status === 'done' ? 1 : importProgress(view)} label="Progreso de la importación" className="[&>[data-slot=progress-indicator]]:bg-domain" />
          <Text size="sm">{importSummary(view, nounPlural, foundWord)}</Text>
          {paused && (
            <Button size="md" className="self-start" onClick={onResume}>
              Continuar la importación
            </Button>
          )}
          {view.missing.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-bold">Ver las {view.notFound} sin encontrar</summary>
              <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto text-muted-foreground">
                {view.missing.map((m, i) => (
                  <li key={`${m}-${i}`}>{m}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
