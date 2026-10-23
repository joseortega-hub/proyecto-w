import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Pantalla sin navegación para no distraer (entrevista, Afinando, reproductor). */
export function FocusTemplate({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-background md:grid md:place-items-center md:py-10">
      <div className={cn('mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-4 px-5 pt-5 pb-7 md:min-h-[780px]', className)}>
        {children}
      </div>
    </div>
  )
}
