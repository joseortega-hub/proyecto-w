import { useState } from 'react'
import { Icon } from '@/components/atoms'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

interface ExplanationProps {
  reason: string
  label?: string
  /** Si se puede plegar; el reproductor la muestra siempre abierta. */
  collapsible?: boolean
  defaultOpen?: boolean
}

/** "Por qué": la explicación de Gemini de por qué este elemento encaja. */
export function Explanation({ reason, label = 'Por qué', collapsible = true, defaultOpen = false }: ExplanationProps) {
  const [open, setOpen] = useState(defaultOpen)
  const box = 'rounded-[10px] bg-accent px-3 py-2.5 text-sm leading-[1.45]'

  if (!collapsible) {
    return (
      <p className={box}>
        <strong className="text-accent-foreground">{label}:</strong> {reason}
      </p>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="inline-flex min-h-8 touch:min-h-11 items-center gap-1 text-[13px] font-bold text-accent-foreground">
        {label}
        <Icon name="chevronDown" className={cn('size-4 transition-transform duration-200', open && 'rotate-180')} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className={cn(box, 'mt-1.5')}>{reason}</p>
      </CollapsibleContent>
    </Collapsible>
  )
}
