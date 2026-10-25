import { Switch } from '@/components/atoms'
import type { SectionGroup } from '@/lib/sections'
import { cn } from '@/lib/utils'

interface SectionTogglesProps {
  groups: SectionGroup[]
  hidden: string[]
  onChange: (id: string, hide: boolean) => void
  onShowAll: () => void
  className?: string
}

/** Interruptores para enseñar u ocultar cada sección, agrupados por pantalla. */
export function SectionToggles({ groups, hidden, onChange, onShowAll, className }: SectionTogglesProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {groups.map((g) => (
        <fieldset key={g.label} className="flex flex-col gap-0.5">
          <legend className="label-caps px-2.5 pb-1">{g.label}</legend>
          {g.sections.map((s) => {
            const shown = !hidden.includes(s.id)
            return (
              <div key={s.id} className="flex min-h-11 items-center justify-between gap-3 rounded-md px-2.5 hover:bg-secondary">
                <span className={cn('min-w-0 text-[15px]', !shown && 'text-muted-foreground line-through decoration-1')}>{s.label}</span>
                <Switch checked={shown} onCheckedChange={(next) => onChange(s.id, !next)} label={`${shown ? 'Ocultar' : 'Mostrar'} «${s.label}» en ${g.label.toLowerCase()}`} />
              </div>
            )
          })}
        </fieldset>
      ))}
      <button
        type="button"
        disabled={hidden.length === 0}
        onClick={onShowAll}
        className="min-h-11 rounded-full px-3 text-sm font-bold text-accent-foreground hover:bg-secondary disabled:text-muted-foreground disabled:opacity-60"
      >
        {hidden.length ? `Mostrar todo (${hidden.length} ${hidden.length === 1 ? 'oculta' : 'ocultas'})` : 'Todo está a la vista'}
      </button>
    </div>
  )
}
