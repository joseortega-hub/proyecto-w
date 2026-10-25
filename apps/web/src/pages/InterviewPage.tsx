import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button, IconButton, Text } from '@/components/atoms'
import { useListSize } from '@/lib/list-size'
import { ListSizeField, ContextBadge, EmptyState, InterviewProgress, UnderstandingCard, type UnderstoodChip } from '@/components/molecules'
import { DemoDock, InterviewPanel } from '@/components/organisms'
import { FocusTemplate } from '@/components/templates/FocusTemplate'
import { ApiError, api, type Answer, type SessionView, type Understanding } from '@/lib/api'
import { clientContext } from '@/lib/context'
import { useDomain } from '@/lib/domain'
import { rememberSession, useDemoMode, useLiveTraces } from '@/lib/ops'
import { storedPreferences } from '@/lib/preferences'
import { useTaste } from '@/lib/taste'

/** /:domain/entrevista crea la sesión y redirige a /:domain/entrevista/:sesion. */
/** Icono del chip de un nombre propio pedido por palabras ("📚 de Sarah J. Maas"). */
const NAMED_ICONS: Record<string, string> = { books: '📚', movies: '🎬', games: '🎮', music: '🎵' }

export function InterviewPage() {
  const { sesion } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const started = useRef(false)
  const domain = useDomain()
  const [listSize, setListSize] = useListSize(domain.id)
  // Punto de partida opcional (texto o voz) que llega desde Inicio en el estado de la navegación.
  const location = useLocation()
  const navState = location.state as { initialText?: string; preferences?: Record<string, string> } | null
  const initialText = navState?.initialText
  // Lo elegido con los botones ya se aplica en la primera pregunta, no solo al afinar.
  const [prefs, setPrefs] = useState<Record<string, string>>(() => navState?.preferences ?? storedPreferences(domain.id))
  // Lo entendido del texto, que la persona corrige en la tarjeta antes de empezar.
  const [understood, setUnderstood] = useState<Understanding | null>(null)
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  // Gustos guardados: salen en la tarjeta y se pueden desactivar solo para esta entrevista.
  const taste = useTaste(domain.id)
  const tasteEntries = useMemo(
    () => [
      ...(taste.data?.likes ?? []).map((e) => ({ ...e, icon: '❤️' })),
      ...(taste.data?.dislikes ?? []).map((e) => ({ ...e, icon: '🚫' })),
    ],
    [taste.data],
  )

  const understand = useMutation({
    mutationFn: () => api.understand(domain.id, initialText!),
    onSuccess: (u) => {
      setUnderstood(u)
      setPrefs((prev) => ({ ...Object.fromEntries(Object.entries(u.preferences).map(([k, v]) => [k, v.value])), ...prev }))
    },
    // Si no se puede entender, se empieza igual: el servidor lo vuelve a intentar con el texto.
    onError: () => setUnderstood({ moods: [], anchors: [], preferences: {}, exclusions: [] }),
  })

  const chips = useMemo<UnderstoodChip[] | null>(() => {
    if (!understood) return null
    const out: UnderstoodChip[] = []
    for (const m of understood.moods) {
      const attr = domain.info?.attributes.find((a) => a.key === m.key)
      const label = m.level === 'high' ? attr?.highLabel : attr?.lowLabel
      if (label) out.push({ id: `mood:${m.key}`, icon: '😴', label })
    }
    for (const a of understood.anchors) {
      out.push(
        a.named
          ? { id: `anchor:${a.label}`, icon: NAMED_ICONS[domain.id] ?? '🎯', label: `de ${a.label}`, note: a.said ? `He entendido ${a.label}` : undefined }
          : { id: `anchor:${a.label}`, icon: '🎯', label: a.label },
      )
    }
    for (const p of domain.info?.preferences ?? []) {
      const value = prefs[p.key]
      if (value && value !== p.anyValue) {
        out.push({ id: `pref:${p.key}`, icon: p.key === 'platforms' ? '🎮' : '🌐', label: p.label, value, options: p.options })
      }
    }
    for (const g of understood.exclusions) out.push({ id: `out:${g}`, icon: '🚫', label: domain.info?.tagGroups.find((t) => t.key === g)?.label ?? g })
    for (const e of tasteEntries) out.push({ id: `taste:${e.id}`, icon: e.icon, label: e.label })
    return out.filter((c) => !removed.has(c.id))
  }, [understood, prefs, removed, domain.info, tasteEntries])

  const start = useMutation({
    mutationFn: async () => {
      const kept = (id: string) => !removed.has(id)
      return api.startSession(domain.id, {
        initialText,
        client: await clientContext(),
        preferences: prefs,
        tasteOff: [...removed].filter((id) => id.startsWith('taste:')).map((id) => id.slice(6)),
        understanding: understood
          ? {
              moods: understood.moods.filter((m) => kept(`mood:${m.key}`)).map(({ key, level }) => ({ key, level })),
              anchors: understood.anchors.filter((a) => kept(`anchor:${a.label}`)),
              preferences: {},
              exclusions: understood.exclusions.filter((g) => kept(`out:${g}`)),
            }
          : undefined,
      })
    },
    onSuccess: (s) => {
      queryClient.setQueryData(['session', s.id], s)
      navigate(domain.path(`entrevista/${s.id}`), { replace: true })
    },
  })

  // Con texto, primero se enseña lo entendido; sin texto, directo a las preguntas.
  useEffect(() => {
    if (!sesion && !started.current) {
      if (initialText) {
        started.current = true
        understand.mutate()
      } else if (!taste.isPending) {
        // Con gustos guardados, la tarjeta también aparece (sin texto no hay nada que entender).
        started.current = true
        if (tasteEntries.length) setUnderstood({ moods: [], anchors: [], preferences: {}, exclusions: [] })
        else start.mutate()
      }
    }
  }, [sesion, start, understand, initialText, taste.isPending, tasteEntries.length])

  // Si no hay nada que corregir, no se hace perder tiempo con la tarjeta (solo al llegar lo entendido).
  const checked = useRef(false)
  useEffect(() => {
    if (!sesion && understood && !checked.current) {
      checked.current = true
      if (chips?.length === 0) start.mutate()
    }
  }, [sesion, understood, chips, start])

  const session = useQuery({
    queryKey: ['session', sesion],
    queryFn: () => api.getSession(sesion!),
    enabled: !!sesion,
  })

  const [demo, setDemo] = useDemoMode()
  const traces = useLiveTraces(sesion, demo)
  useEffect(() => {
    if (sesion) rememberSession(sesion)
  }, [sesion])

  const update = (s: SessionView) => queryClient.setQueryData(['session', s.id], s)
  const onError = (e: Error) => {
    // 409: la sesión ya avanzó (doble toque, otra pestaña). Se recarga en silencio.
    if (e instanceof ApiError && e.status === 409) {
      void queryClient.invalidateQueries({ queryKey: ['session', sesion] })
      return
    }
    toast.error('No he podido seguir', { description: e.message })
  }
  const answer = useMutation({
    mutationFn: ({ a, step }: { a: Answer; step: number }) => api.answer(sesion!, a, step),
    onSuccess: update,
    onError,
  })
  const reply = useMutation({
    mutationFn: ({ text, step }: { text: string; step: number }) => api.reply(sesion!, text, step),
    onSuccess: update,
    onError,
  })
  const undo = useMutation({ mutationFn: () => api.undo(sesion!), onSuccess: update, onError })

  const data = session.data
  const reviewing = !sesion && (!!initialText || !!understood) && !start.isPending && !start.isSuccess && !start.isError
  const thinking = start.isPending || answer.isPending || reply.isPending || undo.isPending || (!data && !session.isError)
  // Respuesta optimista: su etiqueta aparece al instante mientras llega la siguiente pregunta.
  const pendingAnswer = answer.isPending ? answer.variables?.a : undefined
  const optimisticChip = pendingAnswer && pendingAnswer !== 'unknown' ? data?.question?.chips[pendingAnswer] : undefined
  const answerChips = [...(data?.chips ?? []), ...(optimisticChip ? [optimisticChip] : [])]
  const onAnswer = (a: Answer) => {
    // Un solo envío por pregunta, aunque se toque dos veces antes de que se repinte.
    if (!data?.question || answer.isPending) return
    answer.mutate({ a, step: data.step })
  }
  const failed = start.isError || session.isError

  const exit = () => navigate(domain.path())
  const restart = () => {
    started.current = false
    navigate(domain.path('entrevista'), { replace: true })
  }

  if (failed) {
    return (
      <FocusTemplate className="justify-center">
        <EmptyState
          icon="retry"
          title="No he podido empezar"
          description={(start.error ?? session.error)?.message}
          action={<Button onClick={() => window.location.reload()}>Reintentar</Button>}
        />
      </FocusTemplate>
    )
  }

  if (reviewing) {
    return (
      <FocusTemplate className="justify-center">
        <UnderstandingCard
          chips={chips}
          onRemove={(id) => {
            if (id.startsWith('pref:')) setPrefs((p) => ({ ...p, [id.slice(5)]: domain.info?.preferences.find((x) => x.key === id.slice(5))?.anyValue ?? 'any' }))
            else setRemoved((r) => new Set(r).add(id))
          }}
          onChange={(id, value) => setPrefs((p) => ({ ...p, [id.slice(5)]: value }))}
          onStart={() => start.mutate()}
          starting={start.isPending}
        />
        <ListSizeField value={listSize} onChange={setListSize} noun={domain.nounPlural} />
      </FocusTemplate>
    )
  }

  const stepLabel = !data
    ? 'Preparando…'
    : data.question || thinking
      ? `Pregunta ${data.step + (answer.isPending ? 1 : 0)} · máx. ${data.maxQuestions}`
      : 'Perfil listo'

  return (
    <FocusTemplate>
      <header className="flex items-center justify-between">
        <IconButton icon="close" label="Salir de la entrevista" onClick={exit} />
        <Text as="span" font="label">
          {stepLabel}
        </Text>
        <IconButton icon="undo" label="Deshacer la última respuesta" disabled={!data?.canUndo || thinking} onClick={() => undo.mutate()} />
      </header>
      <InterviewProgress confidence={data?.confidence ?? 0.1} />
      {start.isPending && !!understood?.searching?.length && (
        <Text as="p" font="label" className="text-muted-foreground" aria-live="polite">
          Buscando {domain.info?.gender === 'm' ? 'todos los' : 'todas las'} de {understood.searching.join(' y ')} en {domain.info?.source.name ?? 'la fuente'}…
        </Text>
      )}
      {data && (data.context.diaSemana || data.taste.length > 0 || data.fromText.length > 0 || data.anchors.length > 0 || data.filters.length > 0 || data.excluded.length > 0 || data.candidates) && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Lo que ya tengo en cuenta">
          <ContextBadge context={data.context} />
          {data.taste.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-domain-soft px-3 py-1 text-[13px]" title="Tus gustos guardados">
              ♥ {data.taste.slice(0, 3).join(', ')}
              {data.taste.length > 3 ? '…' : ''}
            </span>
          )}
          {data.anchors.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-domain-soft px-3 py-1 text-[13px]" title="Lo que has pedido">
              🎯 {data.anchors.join(', ')}
            </span>
          )}
          {data.filters.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-domain-soft px-3 py-1 text-[13px]" title="Tus filtros">
              🎮 {data.filters.join(', ')}
            </span>
          )}
          {data.excluded.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-domain-soft px-3 py-1 text-[13px]" title="Lo que no quieres">
              🚫 {data.excluded.join(', ')}
            </span>
          )}
          {data.candidates && (
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-[13px] font-bold" aria-live="polite" title="Las que aún pueden encajar contigo">
              Quedan ~{data.candidates.left} candidatas
            </span>
          )}
          {data.fromText.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-[13px] text-muted-foreground">
              Por lo que me has contado: {data.fromText.join(', ')}
            </span>
          )}
        </div>
      )}
      <InterviewPanel
        question={answer.isPending || reply.isPending ? null : (data?.question ?? null)}
        chips={answerChips}
        thinking={thinking}
        onAnswer={onAnswer}
        onReply={(text) => data?.question && !reply.isPending && reply.mutate({ text, step: data.step })}
        onFinish={() => navigate(domain.path(`resultado/${sesion}`))}
        onRestart={restart}
      />
      {demo && <DemoDock rows={traces} onClose={() => setDemo(false)} />}
    </FocusTemplate>
  )
}
