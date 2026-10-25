import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { Button as UiButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const buttonStyles = cva('max-w-full rounded-full font-bold whitespace-normal transition-colors duration-200 ease-standard', {
  variants: {
    variant: {
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
      secondary: 'border-[1.5px] border-border bg-card text-foreground hover:bg-secondary',
      ghost: 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
    },
    size: {
      md: 'h-auto min-h-11 px-5 py-1.5 text-base',
      lg: 'h-auto min-h-13 px-6 py-2 text-[17px]',
    },
    block: { true: 'w-full' },
  },
  defaultVariants: { variant: 'primary', size: 'lg' },
})

export type ButtonProps = Omit<ComponentProps<typeof UiButton>, 'variant' | 'size'> & VariantProps<typeof buttonStyles>

/** Botón de acción principal o secundaria (píldora, 44 px de alto como mínimo). */
export function Button({ variant, size, block, className, ...props }: ButtonProps) {
  return <UiButton className={cn(buttonStyles({ variant, size, block }), className)} {...props} />
}
