import { cn } from '@/lib/utils'

/** Interruptor de encendido/apagado (accesible: role="switch"). */
export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full border-[1.5px] border-border transition-colors duration-200 ease-standard',
        checked ? 'bg-primary' : 'bg-secondary',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-card shadow transition-transform duration-200 ease-standard',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}
