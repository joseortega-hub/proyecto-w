import { Link } from 'react-router'
import { Chip, DomainIcon, Heading, Icon, Meter, Text, type IconName } from '@/components/atoms'
import { CountBars, StatTile } from '@/components/molecules'
import { Card } from '@/components/ui/card'
import type { StoryAi, StoryLearned, StoryTopDomain } from '@/lib/home-types'
import { formatInt } from '@/lib/format'

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 4 })

type WithIcon<T> = T & { icon: IconName }

/** «Tu top»: lo que más se repite en tus listas, por temática, y cuánto encaja con tus gustos. */
export function TopPanel({ top, tasteFit }: { top: WithIcon<StoryTopDomain>[]; tasteFit: number | null }) {
  return (
    <Card className="gap-4 rounded-[22px] px-4 py-5 shadow-none md:px-6">
      <Heading as="h2" size="section">
        Tu top
      </Heading>
      {tasteFit !== null && (
        <div className="flex flex-col gap-1.5">
          <Text size="sm">
            <strong className="font-mono text-xl tabular-nums">{tasteFit} %</strong> de lo que te he recomendado encaja con tus gustos.
          </Text>
          <Meter value={tasteFit / 100} label={`${tasteFit} % de tus listas encaja con tus gustos`} />
        </div>
      )}
      {top.length === 0 ? (
        <Text size="sm" tone="muted">
          Cuando tengas unas cuantas listas, aquí verás tus artistas, sagas y géneros más repetidos.
        </Text>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {top.map((t) => (
            <section key={t.domainId} data-domain={t.domainId} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <DomainIcon icon={t.icon} size="sm" />
                <Text font="label" className="text-domain">
                  {t.name}
                </Text>
              </div>
              {t.creators.length > 0 && <CountBars items={t.creators} unit="veces en tus listas" />}
              {t.genres.length > 0 && <CountBars items={t.genres} unit="elementos" />}
              {t.creators.length === 0 && t.genres.length === 0 && (
                <Text size="xs" tone="muted">
                  Todavía no se repite nada: cada lista es distinta.
                </Text>
              )}
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}

/** «Lo que he aprendido de ti»: gustos y pesos aprendidos de los 👍/👎, por temática. */
export function LearnedPanel({ learned }: { learned: WithIcon<StoryLearned>[] }) {
  return (
    <Card className="gap-4 rounded-[22px] px-4 py-5 shadow-none md:px-6">
      <Heading as="h2" size="section">
        Lo que he aprendido de ti
      </Heading>
      {learned.length === 0 ? (
        <Text size="sm" tone="muted">
          Marca 👍 o 👎 en lo que te recomendemos y aquí verás qué estilos te suben y cuáles te bajan.
        </Text>
      ) : (
        learned.map((l) => (
          <section key={l.domainId} data-domain={l.domainId} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <DomainIcon icon={l.icon} size="sm" />
                <Text font="label" className="text-domain">
                  {l.name}
                </Text>
              </div>
              {(l.thumbsUp > 0 || l.thumbsDown > 0) && (
                <Text font="mono" size="xs" tone="muted">
                  👍 {l.thumbsUp} · 👎 {l.thumbsDown}
                </Text>
              )}
            </div>
            {l.likes.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5">
                <Icon name="heart" className="size-4 fill-current text-domain" />
                {l.likes.map((x) => (
                  <Chip key={x}>{x}</Chip>
                ))}
              </p>
            )}
            {l.up.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5">
                <Icon name="thumbsUp" className="size-4 text-muted-foreground" />
                {l.up.map((x) => (
                  <Chip key={x.label} variant="outline">
                    {x.label} <span className="font-mono font-normal">+{Math.round(x.weight * 100)}</span>
                  </Chip>
                ))}
              </p>
            )}
            {l.down.length > 0 && (
              <p className="flex flex-wrap items-center gap-1.5">
                <Icon name="thumbsDown" className="size-4 text-muted-foreground" />
                {l.down.map((x) => (
                  <Chip key={x.label} variant="guess">
                    {x.label} <span className="font-mono">{Math.round(x.weight * 100)}</span>
                  </Chip>
                ))}
              </p>
            )}
            {l.dislikes.length > 0 && (
              <Text size="xs" tone="muted">
                Lo que no te va: {l.dislikes.join(', ')}.
              </Text>
            )}
          </section>
        ))
      )}
    </Card>
  )
}

/** «La IA en números»: lo que ha hecho la IA por ti, con enlace a «Bajo el capó». */
export function AiPanel({ ai }: { ai: StoryAi }) {
  // «motor» es el respaldo sin IA (plantillas y ranking), no un proveedor.
  const providers = ai.providers.map((p) => `${p.label === 'motor' ? 'motor sin IA' : p.label} (${p.count})`).join(', ')
  return (
    <Card className="gap-4 rounded-[22px] px-4 py-5 shadow-none md:px-6">
      <Heading as="h2" size="section">
        La IA en números
      </Heading>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatTile label="Listas creadas" value={formatInt(ai.lists)} />
        <StatTile label="Preguntas ahorradas" value={formatInt(ai.questionsSaved)} hint="gracias a lo que escribiste" />
        <StatTile label={`Llamadas a la IA`} value={formatInt(ai.calls)} hint={`últimas ${ai.tracesWindowHours} h`} />
        <StatTile label="Coste" value={euros.format(ai.paidEur)} hint={`${euros.format(ai.listCostEur)} a precio de lista`} />
      </div>
      {providers && (
        <Text size="sm" tone="muted">
          Proveedores usados: {providers}.
        </Text>
      )}
      <Link to="/bajo-el-capo" className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-accent px-4 text-[14px] font-bold text-accent-foreground hover:bg-accent/80">
        <Icon name="activity" className="size-4" />
        Ver la IA por dentro
      </Link>
    </Card>
  )
}
