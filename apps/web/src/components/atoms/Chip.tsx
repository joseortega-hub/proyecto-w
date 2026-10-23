import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const chipStyles = cva('rounded-full px-3 py-1 text-[13px] font-bold', {
  variants: {
    variant: {
      /** Algo que ya sabemos de la persona. */
      solid: 'border-transparent bg-accent text-accent-foreground',
      /** La hipótesis que comprueba la pregunta actual. */
      guess: 'border-[1.5px] border-dashed border-muted-foreground bg-transparent font-normal text-muted-foreground',
      outline: 'border-[1.5px] border-border bg-card text-foreground',
    },
  },
  defaultVariants: { variant: 'solid' },
})

export type ChipProps = ComponentProps<'span'> & VariantProps<typeof chipStyles>

export function Chip({ variant, className, ...props }: ChipProps) {
  return <Badge className={cn(chipStyles({ variant }), className)} {...props} />
}
