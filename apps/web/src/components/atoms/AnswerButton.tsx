import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { Button as UiButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const answerStyles = cva(
  'h-auto w-full rounded-lg border-[2.5px] bg-card py-7 font-display text-[28px] font-extrabold transition-[transform,background-color] duration-120 ease-standard active:scale-[0.97] disabled:opacity-60',
  {
    variants: {
      answer: {
        yes: 'border-yes text-yes hover:bg-yes/10',
        no: 'border-no text-no hover:bg-no/10',
      },
    },
  },
)

export type AnswerButtonProps = Omit<ComponentProps<'button'>, 'children'> &
  Required<VariantProps<typeof answerStyles>>

const LABEL = { yes: 'Sí', no: 'No' } as const

/** Respuesta Sí/No. Se distingue sin color: texto y posición fija (Sí siempre a la izquierda). */
export function AnswerButton({ answer, className, ...props }: AnswerButtonProps) {
  return (
    <UiButton variant="ghost" className={cn(answerStyles({ answer }), className)} {...props}>
      {LABEL[answer!]}
    </UiButton>
  )
}
