import { useState } from 'react'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import { cn } from '@/lib/utils'

const STRIPES =
  'bg-[repeating-linear-gradient(135deg,var(--secondary)_0_6px,var(--border)_6px_7px)]'

/** Portada cuadrada; si no hay imagen (o falla), un rayado neutro. */
export function Cover({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cn('overflow-hidden rounded-sm', className)}>
      <AspectRatio ratio={1} className={STRIPES}>
        {src && !failed ? (
          <img src={src} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <span role="img" aria-label={alt} className="block size-full" />
        )}
      </AspectRatio>
    </div>
  )
}
