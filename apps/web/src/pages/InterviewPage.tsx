import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button, IconButton, Text } from '@/components/atoms'
import { EmptyState, InterviewProgress } from '@/components/molecules'
import { InterviewPanel } from '@/components/organisms'
import { FocusTemplate } from '@/components/templates/FocusTemplate'
import { api, type Answer, type SessionView } from '@/lib/api'
import { useDomain } from '@/lib/domain'

/** /:domain/entrevista crea la sesión y redirige a /:domain/entrevista/:sesion. */
export function InterviewPage() {
  const { sesion } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const started = useRef(false)
  const domain = useDomain()

  const start = useMutation({
    mutationFn: () => api.startSession(domain.id),
    onSuccess: (s) => {
      queryClient.setQueryData(['session', s.id], s)
      navigate(domain.path(`entrevista/${s.id}`), { replace: true })
    },
  })

  useEffect(() => {
    if (!sesion && !started.current) {
      started.current = true
      start.mutate()
    }
  }, [sesion, start])

  const session = useQuery({
    queryKey: ['session', sesion],
    queryFn: () => api.getSession(sesion!),
    enabled: !!sesion,
  })

  const update = (s: SessionView) => queryClient.setQueryData(['session', s.id], s)
  const onError = (e: Error) => toast.error('No he podido seguir', { description: e.message })
  const answer = useMutation({ mutationFn: (a: Answer) => api.answer(sesion!, a), onSuccess: update, onError })
  const undo = useMutation({ mutationFn: () => api.undo(sesion!), onSuccess: update, onError })

  const data = session.data
  const thinking = start.isPending || answer.isPending || undo.isPending || (!data && !session.isError)
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
      <InterviewPanel
        question={answer.isPending ? null : (data?.question ?? null)}
        chips={data?.chips ?? []}
        thinking={thinking}
        onAnswer={(a) => answer.mutate(a)}
        onFinish={() => navigate(domain.path(`resultado/${sesion}`))}
        onRestart={restart}
      />
    </FocusTemplate>
  )
}
