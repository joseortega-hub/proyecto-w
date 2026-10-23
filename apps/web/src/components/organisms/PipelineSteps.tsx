import { Icon } from '@/components/atoms'
import { formatInt } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface PipelineProgress {
  profile: boolean
  candidates?: { count: number; total: number }
  fit?: { checked: number; total: number }
  explaining: boolean
  done: boolean
}

type Status = 'done' | 'active' | 'pending'

function Step({ status, children }: { status: Status; children: React.ReactNode }) {
  return (
    <li className={cn('flex items-center gap-3', status === 'active' && 'font-bold text-accent-foreground', status === 'pending' && 'text-muted-foreground')}>
      {status === 'done' && (
        <span className="grid size-6 flex-none place-items-center rounded-full bg-yes text-card">
          <Icon name="check" className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {status === 'active' && <span className="size-6 flex-none animate-pulse rounded-full border-[3px] border-primary" />}
      {status === 'pending' && <span className="size-6 flex-none rounded-full border-2 border-border" />}
      <span>{children}</span>
    </li>
  )
}

/** Los pasos reales de Afinando, alimentados por los eventos del servidor. */
export function PipelineSteps({ progress, gender = 'f' }: { progress: PipelineProgress; gender?: 'f' | 'm' }) {
  const f = gender === 'f'
  const { profile, candidates, fit, explaining, done } = progress
  const fitDone = !!fit && fit.checked >= fit.total
  const status = (isDone: boolean, isActive: boolean): Status => (isDone ? 'done' : isActive ? 'active' : 'pending')

  return (
    <ol aria-label="Progreso" aria-live="polite" className="flex flex-col gap-3 text-base">
      <Step status={status(profile, !profile)}>Perfil calculado</Step>
      <Step status={status(!!candidates, profile && !candidates)}>
        {candidates ? (
          <>
            <span className="font-mono">{candidates.count}</span> {f ? 'candidatas' : 'candidatos'} entre <span className="font-mono">{formatInt(candidates.total)}</span>
          </>
        ) : (
          `Buscando ${f ? 'candidatas' : 'candidatos'}`
        )}
      </Step>
      <Step status={status(fitDone, !!candidates && !fitDone)}>
        Comprobando si encajan{fit && !fitDone && <span className="font-mono"> ({fit.checked}/{fit.total})</span>}
      </Step>
      <Step status={status(done, explaining && !done)}>Escribiendo el porqué de {f ? 'cada una' : 'cada uno'}</Step>
    </ol>
  )
}
