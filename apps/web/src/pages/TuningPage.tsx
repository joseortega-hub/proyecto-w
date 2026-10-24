import { useEffect, useState } from 'react'
import { Button, Heading, Text } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { MoodProfile, PipelineSteps, type PipelineProgress } from '@/components/organisms'
import { FocusTemplate } from '@/components/templates/FocusTemplate'
import { api, type Attribute, type MoodProfile as Profile, type TuningEvent } from '@/lib/api'
import { useDomain } from '@/lib/domain'

interface TuningPageProps {
  sessionId: string
  domainId: string
  refine: string[]
  attributes: Attribute[]
  onDone: () => void
}

/** Afinando: estado de carga de /resultado con el progreso real del servidor (SSE). */
export function TuningPage({ sessionId, refine, attributes, onDone }: TuningPageProps) {
  const [profile, setProfile] = useState<Profile>()
  const [progress, setProgress] = useState<PipelineProgress>({ profile: false, explaining: false, done: false })
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const refineKey = refine.join(',')
  const domain = useDomain()

  useEffect(() => {
    setError(undefined)
    setProgress({ profile: false, explaining: false, done: false })
    const onEvent = (e: TuningEvent) => {
      switch (e.step) {
        case 'profile':
          setProfile(e.profile)
          setProgress((p) => ({ ...p, profile: true }))
          break
        case 'candidates':
          setProgress((p) => ({ ...p, candidates: { count: e.count, total: e.total } }))
          break
        case 'fit':
          setProgress((p) => ({ ...p, fit: { checked: e.checked, total: e.total } }))
          break
        case 'explain':
          setProgress((p) => ({ ...p, explaining: true }))
          break
        case 'done':
          setProgress((p) => ({ ...p, done: true }))
          onDone()
          break
        case 'error':
          setError(e.message)
      }
    }

    // Las preferencias previas ya van en la sesión desde que empezó la entrevista.
    const stop = api.tune(sessionId, refineKey ? refineKey.split(',') : [], onEvent)
    return () => stop()
    // onDone cambia en cada render del padre; solo relanzamos al cambiar la sesión, los ajustes o al reintentar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, refineKey, attempt])

  if (error) {
    return (
      <FocusTemplate className="justify-center">
        <EmptyState icon="retry" title="Se ha torcido algo al afinar" description={error} action={<Button onClick={() => setAttempt((n) => n + 1)}>Reintentar</Button>} />
      </FocusTemplate>
    )
  }

  const scaleAttributes = attributes.filter((a) => a.kind === 'scale')
  return (
    <FocusTemplate className="justify-center gap-[22px] px-6">
      <div className="flex flex-col gap-1.5">
        <Text font="label">Un momento</Text>
        <Heading size="title" className="text-[34px]">
          Afinando tu lista…
        </Heading>
      </div>
      {scaleAttributes.length > 0 && <MoodProfile attributes={scaleAttributes} scales={profile?.scales} />}
      <PipelineSteps progress={progress} gender={domain.info?.gender} />
    </FocusTemplate>
  )
}
