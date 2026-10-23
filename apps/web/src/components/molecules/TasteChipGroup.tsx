import { TasteChip, type TasteState, Text } from '@/components/atoms'
import type { TasteEntry } from '@/lib/api'

interface TasteChipGroupProps {
  label: string
  options: TasteEntry[]
  likes: string[]
  dislikes: string[]
  onToggle: (id: string) => void
}

export const tasteState = (id: string, likes: string[], dislikes: string[]): TasteState =>
  likes.includes(id) ? 'like' : dislikes.includes(id) ? 'dislike' : 'none'

/** Un grupo de gustos para marcar ("Géneros", "Más etiquetas"). */
export function TasteChipGroup({ label, options, likes, dislikes, onToggle }: TasteChipGroupProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2">
        <Text as="span" font="label">
          {label}
        </Text>
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <TasteChip key={o.id} label={o.label} state={tasteState(o.id, likes, dislikes)} onToggle={() => onToggle(o.id)} />
        ))}
      </div>
    </fieldset>
  )
}
