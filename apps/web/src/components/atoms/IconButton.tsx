import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { Button as UiButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Icon, type IconName } from './Icon'

const iconButtonStyles = cva('shrink-0 rounded-full transition-colors duration-200 ease-standard', {
  variants: {
    variant: {
      subtle: 'bg-secondary text-foreground hover:bg-border',
      primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
      accent: 'bg-accent text-accent-foreground hover:bg-accent/80',
      ghost: 'bg-transparent text-current hover:bg-foreground/10',
    },
    size: {
      md: 'size-11 [&_svg]:size-5',
      lg: 'size-18 [&_svg]:size-7',
    },
  },
  defaultVariants: { variant: 'subtle', size: 'md' },
})

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> &
  VariantProps<typeof iconButtonStyles> & {
    icon: IconName
    /** Obligatorio: el botón no tiene texto visible. */
    label: string
  }

export function IconButton({ icon, label, variant, size, className, ...props }: IconButtonProps) {
  return (
    <UiButton
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className={cn(iconButtonStyles({ variant, size }), className)}
      {...props}
    >
      <Icon name={icon} />
    </UiButton>
  )
}
