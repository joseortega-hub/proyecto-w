import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from './Icon'

/**
 * Asa ⠿ para reordenar. Al tacto se agarra con una pulsación larga (el dedo sigue haciendo scroll);
 * con teclado, ↑/↓ mueven la fila. `touch-action: pan-y` deja pasar el scroll hasta que se agarra.
 */
export function DragHandle({ label, active, className, ...props }: ComponentProps<'button'> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title="Arrastra para ordenar (↑ ↓ con el teclado)"
      aria-pressed={active}
      className={cn(
        'grid size-11 flex-none cursor-grab touch-pan-y place-items-center rounded-full text-muted-foreground select-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        active && 'bg-foreground/10 text-foreground',
        className,
      )}
      {...props}
    >
      <Icon name="grip" className="size-5" />
    </button>
  )
}
