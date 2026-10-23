import { Skeleton as UiSkeleton } from '@/components/ui/skeleton'
import { Spinner as UiSpinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <UiSkeleton className={cn('bg-secondary', className)} />
}

export function Spinner({ className, label = 'Cargando' }: { className?: string; label?: string }) {
  return <UiSpinner aria-label={label} className={cn('size-5 text-primary', className)} />
}
