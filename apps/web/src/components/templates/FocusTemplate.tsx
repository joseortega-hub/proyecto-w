import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Pantalla sin navegación para no distraer (entrevista, Afinando, reproductor). */
export function FocusTemplate({ children, className }: { children: ReactNode; className?: string }) {
  // El alto de dentro descuenta la zona segura de arriba (ya va en el padding de fuera): sin scroll de sobra.
  return (
    <div className="pt-safe px-safe min-h-dvh bg-background md:grid md:place-items-center md:py-10">
      <div className={cn(
        'mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-[480px] flex-col gap-4 px-5 pt-5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] md:min-h-[780px]', className)}>
        {children}
      </div>
    </div>
  )
}
