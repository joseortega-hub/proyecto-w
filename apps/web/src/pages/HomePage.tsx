import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Cover, DomainIcon, Heading, Icon, IconButton, Text } from '@/components/atoms'
import { PreferencePicker, StartingPointField } from '@/components/molecules'
import { Card } from '@/components/ui/card'
import { useDomain } from '@/lib/domain'
import { timeAgo } from '@/lib/format'
import { usePreferences } from '@/lib/preferences'
import { useSavedLists } from '@/lib/saved-lists'
import { useSaveTaste, useTaste } from '@/lib/taste'

export function HomePage() {
  const navigate = useNavigate()
  const domain = useDomain()
  const { lists } = useSavedLists(domain.id)
  const last = lists[0]
  const preferences = domain.info?.preferences ?? []
  const { chosen, choose } = usePreferences(domain.id)
  const taste = useTaste(domain.id)
  const skipTaste = useSaveTaste(domain.id)
  const [text, setText] = useState('')

  // Las preferencias habituales guardadas con los gustos vienen marcadas en un dispositivo nuevo.
  useEffect(() => {
    for (const [key, value] of Object.entries(taste.data?.preferences ?? {})) if (!chosen[key]) choose(key, value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taste.data])

  // El texto viaja en el estado de la navegación, nunca en la URL ni en el dispositivo.
  const start = (initialText?: string) => navigate(domain.path('entrevista'), { state: initialText ? { initialText } : null })
  const liked = taste.data?.likes ?? []

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 md:px-10">
      <section className="flex flex-1 flex-col justify-center gap-[18px] py-8">
        {domain.info && (
          <div className="flex items-center gap-2.5">
            <DomainIcon icon={domain.icon} size="sm" />
            <Text font="label" className="text-domain">
              {domain.info.name}
            </Text>
          </div>
        )}
        <Heading size="display">Dime cómo estás y te pongo lo que encaja.</Heading>
        <Text tone="muted" size="lead">
          Unas pocas preguntas de sí o no. Sin formularios ni registro.
        </Text>
        {taste.data && !taste.data.onboarded && (
          <Card className="gap-3 rounded-[14px] border-domain/40 bg-domain-soft px-4 py-3.5 shadow-none">
            <div className="flex items-start gap-3">
              <Icon name="heart" className="mt-0.5 size-5 flex-none text-domain" />
              <div className="flex flex-col gap-0.5">
                <strong className="text-[15px]">Primera vez por aquí</strong>
                <Text size="sm" tone="muted">
                  Cuéntame qué {domain.nounPlural} te molan y las listas lo tendrán en cuenta. Tardas medio minuto.
                </Text>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="md" className="flex-1" onClick={() => navigate(domain.path('gustos?bienvenida'))}>
                Contarte mis gustos
              </Button>
              <Button size="md" variant="ghost" disabled={skipTaste.isPending} onClick={() => skipTaste.mutate({ likes: [], dislikes: [] })}>
                Ahora no
              </Button>
            </div>
          </Card>
        )}
        {liked.length > 0 && (
          <Link to={domain.path('gustos')} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Icon name="heart" className="size-4 flex-none fill-current text-domain" />
            <span className="truncate">Con tus gustos: {liked.map((l) => l.label).join(', ')}</span>
          </Link>
        )}
        {preferences.map((p) => (
          <PreferencePicker key={p.key} preference={p} value={chosen[p.key]} onChange={(v) => choose(p.key, v)} />
        ))}
        <StartingPointField
          value={text}
          onChange={setText}
          label={`¿Cómo estás o qué te apetece ${domain.info?.verb ?? ''}?`.replace(' ?', '?')}
          placeholder="Ej.: vengo reventado del curro y quiero algo tranqui"
        />
        <Button block className="mt-2" onClick={() => start(text.trim() || undefined)}>
          {text.trim() ? 'Empezar con esto' : 'Empezar'}
        </Button>
        {text.trim() ? (
          <Button block variant="ghost" onClick={() => start()}>
            Saltar e ir a las preguntas
          </Button>
        ) : (
          <Button block variant="secondary" onClick={() => navigate(domain.path('biblioteca'))}>
            Explorar la biblioteca
          </Button>
        )}
      </section>
      {last && (
        <Card className="mb-4 gap-2 rounded-[14px] px-3.5 py-3 shadow-none">
          <Text font="label">Tu última lista</Text>
          <div className="flex items-center gap-3">
            <Cover src={last.cover} alt="" className="size-12 flex-none rounded-[8px]" />
            <Link to={domain.path(`resultado/${last.id}`)} className="flex min-w-0 flex-1 flex-col">
              <strong className="truncate text-[15px]">{last.title}</strong>
              <span className="text-[13px] text-muted-foreground">
                {last.count} {domain.nounPlural} · {timeAgo(last.savedAt)}
              </span>
            </Link>
            <IconButton icon="play" label="Abrir la lista" variant="accent" onClick={() => navigate(domain.path(`resultado/${last.id}`))} />
          </div>
        </Card>
      )}
    </div>
  )
}
