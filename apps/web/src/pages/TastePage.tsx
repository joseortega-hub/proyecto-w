import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button, Chip, Heading, Icon, Skeleton, Text } from '@/components/atoms'
import { EmptyState, PreferencePicker } from '@/components/molecules'
import { TasteEditor, type TasteDraft } from '@/components/organisms'
import { api } from '@/lib/api'
import { useDomain } from '@/lib/domain'
import { usePreferences } from '@/lib/preferences'
import { useDeleteTaste, useSaveTaste, useTaste } from '@/lib/taste'

/**
 * /:domain/gustos — "Mis gustos" de la temática. Con `?bienvenida` es el onboarding de la
 * primera vez: se puede saltar, y saltarlo también cuenta (no se vuelve a ofrecer).
 */
export function TastePage() {
  const domain = useDomain()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const welcome = params.has('bienvenida')
  const taste = useTaste(domain.id)
  const save = useSaveTaste(domain.id)
  const remove = useDeleteTaste(domain.id)
  const { chosen, choose } = usePreferences(domain.id)
  const [draft, setDraft] = useState<TasteDraft>({ likes: [], dislikes: [] })
  const [touched, setTouched] = useState(false)

  // Al cargar, el borrador parte de lo guardado.
  useEffect(() => {
    if (taste.data && !touched) setDraft({ likes: taste.data.likes.map((l) => l.id), dislikes: taste.data.dislikes.map((d) => d.id) })
  }, [taste.data, touched])

  const preferences = domain.info?.preferences ?? []
  const change = (value: TasteDraft) => {
    setTouched(true)
    setDraft(value)
  }
  const submit = (value: TasteDraft) =>
    save.mutate(
      { ...value, preferences: chosen },
      {
        onSuccess: () => {
          setTouched(false)
          toast.success(welcome ? 'Hecho: tus próximas listas ya los tienen en cuenta' : 'Gustos guardados')
          if (welcome) navigate(domain.path(), { replace: true })
        },
        onError: (e) => toast.error('No he podido guardarlos', { description: e.message }),
      },
    )

  if (taste.isError) {
    return <EmptyState icon="retry" title="No puedo cargar tus gustos" description={taste.error.message} action={<Button onClick={() => taste.refetch()}>Reintentar</Button>} />
  }

  const data = taste.data
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6 md:px-10 md:py-8">
      <header className="flex flex-col gap-1.5">
        <Text font="label" className="text-domain">
          {domain.info?.name ?? ''} · {welcome ? 'Primera vez' : 'Mis gustos'}
        </Text>
        <Heading>{welcome ? `¿Qué ${domain.nounPlural} te molan?` : `Tus gustos en ${domain.nounPlural}`}</Heading>
        <Text tone="muted">
          Esto es lo de siempre, no lo de hoy: la entrevista seguirá preguntando por tu ánimo. Va ligado a este navegador, sin registro.
        </Text>
      </header>

      {!data ? (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : (
        <>
          <TasteEditor
            value={draft}
            onChange={change}
            groups={data.vocabulary.groups}
            tags={data.vocabulary.tags}
            nounPlural={domain.nounPlural}
            onInterpret={(text) => api.interpretTaste(domain.id, text)}
          />
          {preferences.map((p) => (
            <PreferencePicker key={p.key} preference={p} value={chosen[p.key]} onChange={(v) => choose(p.key, v)} />
          ))}
          {data.learned.length > 0 && (
            <section className="flex flex-col gap-2">
              <Text font="label">Aprendido de tus 👍/👎</Text>
              <div className="flex flex-wrap gap-1.5">
                {data.learned.map((l) => (
                  <Chip key={l.id} variant={l.weight > 0 ? 'solid' : 'outline'} className={l.weight < 0 ? 'line-through' : undefined}>
                    {l.label}
                  </Chip>
                ))}
              </div>
            </section>
          )}
          <div className="sticky bottom-0 -mx-5 flex flex-col gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
            <Button block onClick={() => submit(draft)} disabled={save.isPending}>
              <Icon name="heart" />
              {save.isPending ? 'Guardando…' : welcome ? 'Listo, a por ello' : 'Guardar mis gustos'}
            </Button>
            {welcome ? (
              <Button block variant="ghost" onClick={() => submit({ likes: [], dislikes: [] })} disabled={save.isPending}>
                Saltar por ahora
              </Button>
            ) : (
              data.onboarded && (
                <Button
                  block
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (!window.confirm(`¿Borrar tus gustos de ${domain.nounPlural}, con tus 👍/👎?`)) return
                    remove.mutate(undefined, {
                      onSuccess: () => {
                        setTouched(false)
                        toast.success('Gustos borrados')
                      },
                    })
                  }}
                >
                  <Icon name="trash" />
                  Borrar mis gustos
                </Button>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
