import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps, ElementType } from 'react'
import { cn } from '@/lib/utils'

const headingStyles = cva('font-display font-extrabold tracking-[-0.01em] text-balance', {
  variants: {
    size: {
      display: 'text-[38px] leading-[1.05] md:text-4xl',
      question: 'text-[34px] leading-[1.08] md:text-3xl',
      title: 'text-[30px] leading-[1.08]',
      section: 'text-lg leading-snug',
      brand: 'text-[22px] leading-none',
    },
  },
  defaultVariants: { size: 'title' },
})

type HeadingProps = ComponentProps<'h1'> & VariantProps<typeof headingStyles> & { as?: ElementType }

export function Heading({ as: Tag = 'h1', size, className, ...props }: HeadingProps) {
  return <Tag className={cn(headingStyles({ size }), className)} {...props} />
}

const textStyles = cva('', {
  variants: {
    tone: {
      default: 'text-foreground',
      muted: 'text-muted-foreground',
      accent: 'text-accent-foreground',
      signal: 'text-signal-foreground',
    },
    size: {
      xs: 'text-xs',
      sm: 'text-sm',
      base: 'text-base',
      lead: 'text-[17px] leading-normal',
    },
    font: {
      body: 'font-body',
      mono: 'font-mono tabular-nums',
      label: 'label-caps',
    },
  },
  defaultVariants: { tone: 'default', size: 'base', font: 'body' },
})

type TextProps = ComponentProps<'p'> & VariantProps<typeof textStyles> & { as?: ElementType }

export function Text({ as: Tag = 'p', tone, size, font, className, ...props }: TextProps) {
  return <Tag className={cn(textStyles({ tone, size, font }), className)} {...props} />
}
