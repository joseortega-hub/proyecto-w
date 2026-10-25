import { useId, useRef } from 'react'
import { Icon, type IconName, Spinner, Text } from '@/components/atoms'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { FEEDBACK_KINDS, MAX_IMAGES, MAX_MESSAGE, type FeedbackImage, type FeedbackKind } from '@/lib/feedback'
import { cn } from '@/lib/utils'

const KIND_ICON: Record<FeedbackKind, IconName> = { error: 'bug', idea: 'idea', mejora: 'improve' }

interface FeedbackFormProps {
  kind: FeedbackKind
  onKind: (kind: FeedbackKind) => void
  message: string
  onMessage: (message: string) => void
  images: FeedbackImage[]
  onAddFiles: (files: File[]) => void
  onRemoveImage: (index: number) => void
  /** Mientras se comprimen las imágenes. */
  compressing?: boolean
  /** Lo que se envía solo: «/games/biblioteca/1 · Videojuegos». */
  contextLabel: string
  error?: string | null
}

/** Formulario del buzón: tipo, texto, imágenes (captura o foto) y la pantalla actual, que va sola. */
export function FeedbackForm({ kind, onKind, message, onMessage, images, onAddFiles, onRemoveImage, compressing, contextLabel, error }: FeedbackFormProps) {
  const textId = useId()
  const input = useRef<HTMLInputElement>(null)
  const full = images.length >= MAX_IMAGES
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup type="single" value={kind} onValueChange={(v) => v && onKind(v as FeedbackKind)} aria-label="Tipo de comentario" className="grid w-full grid-cols-3 gap-2">
        {FEEDBACK_KINDS.map((k) => (
          <ToggleGroupItem
            key={k.id}
            value={k.id}
            title={k.hint}
            className="flex h-auto min-h-16 flex-col gap-1 rounded-lg! border-[1.5px] border-border bg-card px-2 py-2 text-sm font-bold transition-colors motion-reduce:transition-none hover:bg-secondary data-[state=on]:border-domain data-[state=on]:bg-domain-soft"
          >
            <Icon name={KIND_ICON[k.id]} className="size-5 text-domain" />
            {k.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={textId} className="label-caps">
          {FEEDBACK_KINDS.find((k) => k.id === kind)?.hint}
        </label>
        <textarea
          id={textId}
          value={message}
          onChange={(e) => onMessage(e.target.value.slice(0, MAX_MESSAGE))}
          rows={5}
          maxLength={MAX_MESSAGE}
          placeholder={kind === 'error' ? 'Qué hacías, qué esperabas y qué ha pasado.' : 'Cuéntanos tu idea con el detalle que quieras.'}
          className="min-h-28 w-full resize-y rounded-[14px] border-[1.5px] border-border bg-card px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus:border-domain"
        />
        <Text size="xs" tone="muted" className="self-end font-mono">
          {message.length}/{MAX_MESSAGE}
        </Text>
      </div>
      <div className="flex flex-col gap-2">
        <span className="label-caps">
          Imágenes ({images.length}/{MAX_IMAGES})
        </span>
        <ul className="flex flex-wrap gap-2" aria-label="Imágenes adjuntas">
          {images.map((img, i) => (
            <li key={i} className="relative size-20 overflow-hidden rounded-[10px] border border-border bg-secondary">
              <img src={`data:${img.type};base64,${img.data}`} alt={`Imagen ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onRemoveImage(i)}
                aria-label={`Quitar la imagen ${i + 1}`}
                className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-black/70 text-white focus-visible:ring-2 focus-visible:ring-white"
              >
                <Icon name="close" className="size-3.5" />
              </button>
            </li>
          ))}
          {!full && (
            <li>
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={compressing}
                className={cn(
                  'grid size-20 place-items-center rounded-[10px] border-[1.5px] border-dashed border-border text-muted-foreground transition-colors hover:border-domain hover:text-foreground motion-reduce:transition-none',
                  compressing && 'cursor-wait',
                )}
              >
                {compressing ? <Spinner /> : <Icon name="image" className="size-6" />}
                <span className="sr-only">{compressing ? 'Preparando la imagen…' : 'Añadir una captura o foto'}</span>
              </button>
            </li>
          )}
        </ul>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            if (files.length) onAddFiles(files)
          }}
        />
        <Text size="xs" tone="muted">
          Se comprimen en tu dispositivo antes de enviarse.
        </Text>
      </div>
      <Text size="sm" tone="muted" className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2">
        <Icon name="info" className="size-4 flex-none" />
        <span className="min-w-0 [overflow-wrap:anywhere]">Se envía con: {contextLabel}</span>
      </Text>
      {error && (
        <Text size="sm" role="alert" className="text-destructive">
          {error}
        </Text>
      )}
    </div>
  )
}
