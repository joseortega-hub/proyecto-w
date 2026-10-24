import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Icon, Skeleton, Text, VIBE_SOURCES, VibeSourceIcon, isVerticalVibe, type VibeSourceKey } from '@/components/atoms'
import { VibeDimension, VibeHeader } from '@/components/molecules'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { vibeGradient } from '@/lib/vibe/vibe-color'
import { vibeSpec } from '@/lib/vibe/vibe-spec'
import { vibeTitle, type VibeContext } from '@/lib/vibe/vibe-title'
import type { VibeAttribute } from '@/lib/vibe/vibe-words'

export interface VibeCardProps {
  domainId: string
  attributes: (VibeAttribute & { description?: string })[]
  /** Perfil actual 0–1 por dimensión. Sin él, esqueleto de carga. */
  scales?: Record<string, number>
  /** De dónde sale cada dimensión (💬 ❓ ❤️ 🌦️ 💭). */
  sources?: Record<string, string>
  /** Confianza 0–1: por debajo de 0,5 la dimensión se da por supuesta. */
  confidence?: Record<string, number>
  context?: VibeContext | null
  /** Dimensiones que la persona ha movido ya (el servidor las recuerda). */
  adjusted?: string[]
  /** El servidor está reordenando la lista. */
  pending?: boolean
  sharing?: boolean
  /** Al soltar una barra: las dimensiones movidas con su valor, para reordenar la lista. */
  onCommit?: (moved: Record<string, number>) => void
  onReset?: () => void
  onShare?: () => void
}

const HINT_KEY = 'sintonia.vibe-hint'
const seenHint = () => {
  try {
    return localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return true
  }
}

const SURE: VibeSourceKey[] = ['text', 'answer', 'you']

/**
 * "Tu vibra": el nombre de la vibra con su degradado y una barra por dimensión que se arrastra.
 * Al soltar, la lista se reordena dentro de la bolsa de la entrevista, sin preguntar de nuevo.
 */
export function VibeCard({ domainId, attributes, scales, sources = {}, confidence = {}, context, adjusted = [], pending, sharing, onCommit, onReset, onShare }: VibeCardProps) {
  const spec = vibeSpec(domainId)
  const [draft, setDraft] = useState<Record<string, number>>(scales ?? {})
  const [touched, setTouched] = useState<string[]>([])
  // Al tacto, las barras se agarran con pulsación larga o, con "Ajustar", directamente.
  const [editing, setEditing] = useState(false)
  const [hint, setHint] = useState(() => !seenHint())
  const bars = useRef<HTMLDivElement>(null)
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  useEffect(() => {
    if (!editing) return
    const outside = (e: PointerEvent) => {
      if (!bars.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-vibe-edit]')) setEditing(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [editing])
  useEffect(() => {
    if (scales) setDraft(scales)
  }, [scales])
  useEffect(() => setTouched(adjusted), [adjusted.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = useMemo(() => vibeTitle(domainId, draft, context), [domainId, draft, context])
  const gradient = useMemo(() => vibeGradient(draft[spec.axes.drive] ?? 0.5, draft[spec.axes.mood] ?? 0.5), [draft, spec.axes.drive, spec.axes.mood])

  if (!scales) {
    return (
      <Card aria-label="Tu vibra" aria-busy className="gap-3.5 rounded-[16px] p-[18px] shadow-none">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </Card>
    )
  }

  const commit = (key: string, value: number) => {
    const keys = [...new Set([...touched, key])]
    setTouched(keys)
    onCommit?.(Object.fromEntries(keys.map((k) => [k, k === key ? value : (draft[k] ?? 0.5)])))
  }
  const sourceOf = (key: string): VibeSourceKey => (touched.includes(key) ? 'you' : ((sources[key] as VibeSourceKey) ?? 'guess'))
  const solidOf = (key: string) => touched.includes(key) || (SURE.includes(sourceOf(key)) && (confidence[key] ?? 1) >= 0.5)
  const used = [...new Set(attributes.map((a) => sourceOf(a.key)))]
  const vertical = isVerticalVibe(spec.variant)

  return (
    <Card aria-label="Tu vibra" className="gap-4 rounded-[16px] p-[18px] shadow-none">
      <VibeHeader title={title} gradient={gradient} />
      <div ref={bars} className={cn(vertical ? 'grid grid-cols-3 gap-x-2 gap-y-5' : 'flex flex-col gap-3.5')} aria-busy={pending}>
        {attributes.map((a) => (
          <VibeDimension
            key={a.key}
            attribute={a}
            value={draft[a.key] ?? 0.5}
            source={sourceOf(a.key)}
            solid={solidOf(a.key)}
            variant={spec.variant}
            disabled={pending}
            editing={editing}
            onChange={(v) => setDraft((d) => ({ ...d, [a.key]: v }))}
            onCommit={(v) => {
              commit(a.key, v)
              try {
                localStorage.setItem(HINT_KEY, '1')
              } catch {
                /* sin almacenamiento: la pista se repite */
              }
              setHint(false)
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground" aria-label="De dónde sale cada barra">
        {used.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <VibeSourceIcon source={s} className="size-5 text-[11px]" /> {VIBE_SOURCES[s].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <VibeSourceIcon source="guess" solid={false} className="size-5 text-[11px]" /> punteado = supuesto
        </span>
      </div>
      <Text size="sm" tone="muted" role="status" aria-live="polite">
        {pending
          ? 'Reordenando la lista…'
          : coarse
            ? editing
              ? 'Modo ajuste: arrastra una barra y la lista se reordena.'
              : hint
                ? 'Mantén pulsado para ajustar una barra; si solo haces scroll, no se mueve.'
                : 'Mantén pulsada una barra para ajustarla, o toca «Ajustar».'
            : 'Arrastra una barra y la lista se reordena, sin repetir la entrevista.'}
      </Text>
      <div className="flex flex-wrap gap-2">
        {coarse && (
          <Button variant={editing ? 'primary' : 'secondary'} size="md" data-vibe-edit aria-pressed={editing} onClick={() => setEditing((v) => !v)} disabled={pending}>
            <Icon name={editing ? 'check' : 'edit'} /> {editing ? 'Listo' : 'Ajustar'}
          </Button>
        )}
        <Button variant="secondary" size="md" className="flex-1" onClick={onShare} disabled={sharing || pending}>
          <Icon name="share" /> {sharing ? 'Preparando…' : 'Compartir mi vibra'}
        </Button>
        {adjusted.length > 0 && (
          <Button variant="ghost" size="md" onClick={onReset} disabled={pending}>
            <Icon name="undo" /> Volver a la original
          </Button>
        )}
      </div>
    </Card>
  )
}
