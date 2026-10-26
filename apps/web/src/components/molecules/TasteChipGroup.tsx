import { useState } from 'react'
import { Button, Icon, TasteChip, type TasteState } from '@/components/atoms'
import type { TasteEntry } from '@/lib/api'
import { cn } from '@/lib/utils'
import { BottomSheet } from './BottomSheet'

interface TasteChipGroupProps {
  label: string
  options: TasteEntry[]
  likes: string[]
  dislikes: string[]
  onToggle: (id: string) => void
}

export const tasteState = (id: string, likes: string[], dislikes: string[]): TasteState =>
  likes.includes(id) ? 'like' : dislikes.includes(id) ? 'dislike' : 'none'

/**
 * Un grupo de gustos para marcar ("Géneros", "Más etiquetas"), compacto como los filtros: un
 * botón con lo marcado (♥ y 👎) que abre una hoja con todas las opciones.
 */
export function TasteChipGroup({ label, options, likes, dislikes, onToggle }: TasteChipGroupProps) {
  const [open, setOpen] = useState(false)
  const liked = options.filter((o) => likes.includes(o.id)).length
  const disliked = options.filter((o) => dislikes.includes(o.id)).length
  const marked = liked + disliked
  return (
    <div className="flex">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={marked ? `${label}: ${liked} te gustan y ${disliked} no. Ver todos` : `${label}: ver todos`}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[13px] font-bold',
          'focus-visible:ring-2 focus-visible:ring-domain focus-visible:outline-none',
          marked ? 'border-domain bg-domain-soft text-domain' : 'border-border hover:bg-secondary',
        )}
      >
        <Icon name="filter" className="size-4" />
        {label}
        {liked > 0 && <span className="font-mono text-[11px]">♥ {liked}</span>}
        {disliked > 0 && <span className="font-mono text-[11px]">👎 {disliked}</span>}
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        footer={
          <Button size="md" className="flex-1" onClick={() => setOpen(false)}>
            Listo
          </Button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <TasteChip key={o.id} label={o.label} state={tasteState(o.id, likes, dislikes)} onToggle={() => onToggle(o.id)} />
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
