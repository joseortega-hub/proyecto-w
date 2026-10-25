import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from '@/components/atoms'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Barra de acciones fija abajo (respeta la barra del iPhone). */
  footer?: ReactNode
  className?: string
}

/** Hoja modal: sube desde abajo en el móvil y se centra en pantallas grandes. Cierra con Esc, tocando fuera o con la X. */
export function BottomSheet({ open, onClose, title, children, footer, className }: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="sheet fixed inset-x-0 top-auto bottom-0 m-0 w-full max-w-none overflow-hidden rounded-t-xl border-[1.5px] border-border bg-card p-0 text-foreground backdrop:bg-black/60 md:inset-0 md:m-auto md:max-w-xl md:rounded-xl md:[max-height:90dvh] md:h-fit"
    >
      {open && (
        <div className={cn('flex max-h-[92dvh] min-w-0 flex-col md:max-h-[90dvh]', className)}>
          {/* Asa visual del móvil: indica que es una hoja que sube desde abajo. */}
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-border md:hidden" />
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-2 pl-[max(1.25rem,env(safe-area-inset-left))]">
            <h2 className="min-w-0 truncate font-display text-lg font-extrabold">{title}</h2>
            <IconButton icon="close" variant="ghost" label="Cerrar" onClick={onClose} />
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer && <div className="flex gap-2 border-t border-border bg-card px-5 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}
