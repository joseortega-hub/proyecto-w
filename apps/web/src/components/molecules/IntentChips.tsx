import { DomainIcon, Text, type IconName } from '@/components/atoms'
import { cn } from '@/lib/utils'

export interface IntentChoice {
  id: string
  name: string
  icon: IconName
}

interface IntentChipsProps {
  choices: IntentChoice[]
  onPick: (id: string) => void
  /** Mensaje sobre los chips; por defecto, el de «no lo tengo claro». */
  message?: string
  className?: string
}

/** Cuando la barra no tiene claro a qué temática ir, ofrece 2-3 para elegir con un toque. */
export function IntentChips({ choices, onPick, message = '¿Para qué temática lo quieres?', className }: IntentChipsProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)} role="group" aria-label={message}>
      <Text size="sm" className="font-bold">
        {message}
      </Text>
      <div className="flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            data-domain={c.id}
            onClick={() => onPick(c.id)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-border bg-card py-1 pr-4 pl-1.5 text-[15px] font-bold text-foreground transition-colors hover:border-domain hover:bg-domain-soft"
          >
            <DomainIcon icon={c.icon} size="sm" className="rounded-full" />
            {c.name}
          </button>
        ))}
      </div>
    </div>
  )
}
