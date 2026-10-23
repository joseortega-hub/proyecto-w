import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from './Icon'

/** Campo de búsqueda con lupa. `label` es el nombre accesible (y el placeholder si no se da otro). */
export function SearchField({ label, className, placeholder, ...props }: ComponentProps<'input'> & { label: string }) {
  return (
    <label className={cn('flex min-h-11 items-center gap-2 rounded-md border-[1.5px] border-border bg-card px-3 focus-within:border-ring', className)}>
      <Icon name="search" className="size-4 text-muted-foreground" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        placeholder={placeholder ?? label}
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        {...props}
      />
    </label>
  )
}
