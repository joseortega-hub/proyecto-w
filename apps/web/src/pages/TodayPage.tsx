import { useNavigate } from 'react-router'
import { Skeleton } from '@/components/atoms'
import { DomainTile, EmptyState, Hideable } from '@/components/molecules'
import { ComboCard, TodayHero, type ComboSlotView } from '@/components/organisms'
import { GlobalShell } from '@/components/templates/GlobalShell'
import { domainIcon, useDomains } from '@/lib/domain'
import { formatInt, timeAgo } from '@/lib/format'
import { localContext } from '@/lib/greeting'
import { describeContext } from '@/components/molecules'
import { useHome, useUniversalBar } from '@/lib/home'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "/": «Hoy para ti». Saludo con contexto, barra universal, combo de esta noche y las temáticas. */
export function TodayPage() {
  const navigate = useNavigate()
  const domains = useDomains()
  const home = useHome()
  const bar = useUniversalBar()
  const context = home.data?.context ?? localContext()
  const activity = new Map((home.data?.activity ?? []).map((a) => [a.domainId, a]))
  const info = (id: string) => domains.data?.find((d) => d.id === id)

  // Opciones de la barra: las que propone la API o, si falló, las primeras temáticas con contenido.
  const choiceIds = bar.error
    ? (domains.data ?? []).filter((d) => d.itemCount > 0).slice(0, 3).map((d) => d.id)
    : (bar.choices?.options ?? []).map((o) => o.domainId)
  const choices = choiceIds.flatMap((id) => {
    const d = info(id)
    return d ? [{ id, name: d.name, icon: domainIcon(id) }] : []
  })

  const slots: ComboSlotView[] = (home.data?.combo?.slots ?? []).flatMap((s) => {
    const d = info(s.domainId)
    if (!d) return []
    return [
      {
        domainId: s.domainId,
        icon: domainIcon(s.domainId),
        name: d.personal ? d.name : capitalize(d.itemNoun),
        role: s.role,
        why: s.why,
        entries: s.entries.map((e) => ({
          id: e.item.id,
          title: e.item.title,
          subtitle: e.item.subtitle,
          imageUrl: e.item.imageUrl,
          reason: e.reason,
          onOpen: () => navigate(`/${s.domainId}/biblioteca/${e.item.id}`),
        })),
      },
    ]
  })

  return (
    <GlobalShell>
      <TodayHero
        context={context}
        value={bar.text}
        onChange={bar.setText}
        onSubmit={bar.submit}
        busy={bar.busy}
        choices={choices}
        choicesMessage={bar.error ?? undefined}
        onPick={bar.pick}
      />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Hideable id="today.combo">
        {home.isPending || slots.length > 0 ? (
          <ComboCard
            title={home.data?.combo?.title ?? 'El combo de esta noche'}
            subtitle={describeContext(context) ? `Según ${describeContext(context)} y tus gustos` : 'Según la hora y tus gustos'}
            slots={slots}
            loading={home.isPending}
          />
        ) : null}
        </Hideable>
        <section aria-label="Temáticas" className="flex flex-col gap-2.5 lg:col-start-2 lg:row-start-1" aria-busy={domains.isPending}>
          {domains.isError ? (
            <EmptyState icon="retry" title="No puedo cargar los catálogos" description={domains.error.message} />
          ) : domains.isPending ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 w-full rounded-[14px]" />)
          ) : (
            domains.data.map((d) => {
              const a = activity.get(d.id)
              const resume = a?.resumeSessionId
                ? { label: 'Continuar', onClick: () => navigate(`/${d.id}/entrevista/${a.resumeSessionId}`) }
                : a?.lastList
                  ? { label: 'Continuar', onClick: () => navigate(`/${d.id}/resultado/${a.lastList!.sessionId}`) }
                  : null
              return (
                <DomainTile
                  key={d.id}
                  id={d.id}
                  name={d.name}
                  icon={domainIcon(d.id)}
                  // El catálogo personal empieza vacío: se llena al conectar la cuenta.
                  disabled={d.itemCount === 0 && !d.personal}
                  description={
                    d.personal
                      ? d.itemCount
                        ? `${formatInt(d.itemCount)} ${d.itemNounPlural} de tu ${d.source.name}`
                        : d.id === 'folder'
                          ? 'Elige tu carpeta… tus canciones no salen de tu dispositivo'
                          : `Conecta tu ${d.source.name} y usa tu propia música`
                      : d.itemCount
                        ? `${formatInt(d.itemCount)} ${d.itemNounPlural} de ${d.source?.name ?? 'su catálogo'}`
                        : `Próximamente · catálogo de ${d.source?.name ?? '—'}`
                  }
                  lastList={a?.lastList ? `${a.lastList.title} · ${timeAgo(a.lastList.at)}` : null}
                  action={resume}
                  onOpen={() => navigate(`/${d.id}`)}
                />
              )
            })
          )}
        </section>
      </div>
    </GlobalShell>
  )
}
