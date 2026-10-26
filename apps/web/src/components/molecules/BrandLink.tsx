import { Link } from 'react-router'
import { Heading, Icon } from '@/components/atoms'
import { cn } from '@/lib/utils'

/**
 * La marca como botón de inicio: icono de casa en una pastilla con el color de la temática y
 * «Sintonía» al lado, para que se vea que lleva a «Hoy para ti». Al pasar o enfocar, se resalta.
 */
export function BrandLink({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="Sintonía: ir a Hoy para ti"
      className={cn(
        'group/brand inline-flex min-h-11 flex-none items-center gap-2 rounded-full pr-2 outline-none',
        'focus-visible:ring-2 focus-visible:ring-domain focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-full bg-domain-soft text-domain transition-colors duration-200 group-hover/brand:bg-domain group-hover/brand:text-background motion-reduce:transition-none"
      >
        <Icon name="home" className="size-4" />
      </span>
      <Heading as="span" size="brand" className="decoration-domain decoration-2 underline-offset-4 group-hover/brand:underline">
        Sintonía
      </Heading>
    </Link>
  )
}
