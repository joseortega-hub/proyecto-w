import { useState } from 'react'
import { Button, Icon, Text } from '@/components/atoms'
import { StartingPointField, TasteChipGroup } from '@/components/molecules'
import type { TasteEntry } from '@/lib/api'

export interface TasteDraft {
  likes: string[]
  dislikes: string[]
}

interface TasteEditorProps {
  value: TasteDraft
  onChange: (value: TasteDraft) => void
  groups: TasteEntry[]
  tags: TasteEntry[]
  /** Convierte texto libre en gustos del catálogo (no lo guarda). */
  onInterpret?: (text: string) => Promise<{ likes: TasteEntry[]; dislikes: TasteEntry[] }>
  /** "videojuegos", para los textos. */
  nounPlural: string
  /** Etiquetas visibles antes de "Ver más". */
  initialTags?: number
}

/** Ciclo de cada chip: nada → me gusta → no me gusta → nada. */
export function cycleTaste(value: TasteDraft, id: string): TasteDraft {
  if (value.likes.includes(id)) return { likes: value.likes.filter((l) => l !== id), dislikes: [...value.dislikes, id] }
  if (value.dislikes.includes(id)) return { ...value, dislikes: value.dislikes.filter((d) => d !== id) }
  return { ...value, likes: [...value.likes, id] }
}

/**
 * Editor de gustos: géneros del dominio, etiquetas frecuentes del catálogo y texto libre
 * ("me encantan Pokémon y los mundos abiertos") que la IA traduce a esas etiquetas.
 */
export function TasteEditor({ value, onChange, groups, tags, onInterpret, nounPlural, initialTags = 24 }: TasteEditorProps) {
  const [text, setText] = useState('')
  const [interpreting, setInterpreting] = useState(false)
  const [note, setNote] = useState<string>()
  const [showAll, setShowAll] = useState(false)
  // Lo que venga del texto y no esté entre las etiquetas visibles, se muestra igual.
  const [extra, setExtra] = useState<TasteEntry[]>([])

  const known = new Set([...groups, ...tags].map((t) => t.id))
  const marked = new Set([...value.likes, ...value.dislikes])
  const visible = showAll ? tags : tags.filter((t, i) => i < initialTags || marked.has(t.id))
  const extraVisible = extra.filter((e) => !known.has(e.id))

  const interpret = async () => {
    if (!onInterpret || !text.trim()) return
    setInterpreting(true)
    setNote(undefined)
    try {
      const found = await onInterpret(text)
      const likes = [...new Set([...value.likes.filter((l) => !found.dislikes.some((d) => d.id === l)), ...found.likes.map((l) => l.id)])]
      const dislikes = [...new Set([...value.dislikes.filter((d) => !likes.includes(d)), ...found.dislikes.map((d) => d.id)])]
      onChange({ likes, dislikes })
      setExtra((prev) => [...prev, ...found.likes, ...found.dislikes])
      const all = [...found.likes, ...found.dislikes]
      setNote(all.length ? `He marcado: ${all.map((e) => e.label).join(', ')}. Revísalo abajo.` : 'No he sacado nada claro; prueba con géneros o ejemplos.')
      setText('')
    } catch {
      setNote('No he podido entenderlo ahora mismo. Marca los chips a mano.')
    } finally {
      setInterpreting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {onInterpret && (
        <div className="flex flex-col gap-2">
          <StartingPointField
            value={text}
            onChange={setText}
            label="Cuéntamelo con tus palabras"
            placeholder={`Ej.: me flipan los mundos abiertos y las sagas de rol; el terror no me va`}
            hint="Lo traduzco a etiquetas del catálogo. No guardo el texto."
          />
          <Button variant="secondary" size="md" onClick={interpret} disabled={!text.trim() || interpreting} className="self-start">
            <Icon name="wand" />
            {interpreting ? 'Entendiendo…' : 'Marcar por mí'}
          </Button>
          {note && (
            <Text size="sm" role="status">
              {note}
            </Text>
          )}
        </div>
      )}
      <Text tone="muted" size="sm">
        Toca una vez lo que te gusta (♥) y otra vez lo que no te va (tachado). Nada de esto quita {nounPlural} de tus listas: solo
        sube lo que más te pega.
      </Text>
      <TasteChipGroup label="Géneros" options={groups} likes={value.likes} dislikes={value.dislikes} onToggle={(id) => onChange(cycleTaste(value, id))} />
      <TasteChipGroup
        label="Más concreto"
        options={[...extraVisible, ...visible]}
        likes={value.likes}
        dislikes={value.dislikes}
        onToggle={(id) => onChange(cycleTaste(value, id))}
      />
      {tags.length > initialTags && (
        <Button variant="ghost" size="md" className="self-start" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Ver menos' : `Ver más (${tags.length - initialTags})`}
        </Button>
      )}
    </div>
  )
}
