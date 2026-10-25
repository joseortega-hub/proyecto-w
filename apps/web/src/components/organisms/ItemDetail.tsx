import { Button, Chip, Cover, Heading, Icon, Text } from '@/components/atoms'
import { AttributeMeter, ItemRow, LearnMore, SourceAttribution, TechSheet } from '@/components/molecules'
import type { Attribute, DomainInfo, EntityLinks, Item, ItemDetails } from '@/lib/api'
import { techSheet } from '@/lib/details'
import { formatDuration } from '@/lib/format'
import { itemYear } from './ItemGrid'

interface ItemDetailProps {
  item: Item
  domain: Pick<DomainInfo, 'creatorLabel' | 'playable' | 'source' | 'itemNounPlural'>
  attributes: Attribute[]
  /** Detalles más recientes (en música llegan después, desde MusicBrainz); por defecto, los del elemento. */
  details?: ItemDetails
  similar?: { similarity: number; item: Item }[]
  /** "Para saber más" sobre su saga, autoría, estudio o artista; sin enlaces no se muestra. */
  links?: EntityLinks
  /** Mientras se buscan los enlaces y sobre qué ("Rockstar North"). */
  linksLoading?: boolean
  linksName?: string | null
  playing?: boolean
  onPlay?: () => void
  onOpenSimilar?: (item: Item) => void
}

/** "120 BPM · La menor" si el sonido se midió en el dispositivo ("Mi carpeta"). */
function soundLine(item: Item): string | null {
  const bpm = item.facets?.bpm
  const key = item.facets?.musicKey
  if (!item.facets?.measured) return null
  return [bpm ? `${bpm} BPM` : null, typeof key === 'string' ? key : null].filter(Boolean).join(' · ') || null
}

/** De dónde sale cada valor cuando hay medición: medido o estimado con IA. */
const originOf = (measured: string | string[] | undefined, key: string) =>
  !Array.isArray(measured) ? undefined : measured.includes(key) ? ('measured' as const) : ('ai' as const)

/**
 * Ficha de un elemento. En música se reproduce aquí; en el resto de temáticas no hay
 * contenido que reproducir, así que se enlaza a la fuente con su atribución.
 */
export function ItemDetail({ item, domain, attributes, details, similar, links, linksLoading, linksName, playing, onPlay, onOpenSimilar }: ItemDetailProps) {
  const scales = attributes.filter((a) => a.kind === 'scale' && item.attributes[a.key] !== undefined)
  const sheet = techSheet(item.domainId, details ?? item.details)
  const meta = [itemYear(item), item.durationSec ? formatDuration(item.durationSec) : null].filter(Boolean).join(' · ')
  const sound = soundLine(item)
  const measured = item.facets?.measured
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex flex-col gap-4 md:w-72 md:flex-none">
        <Cover src={item.imageUrl} alt={`Portada de ${item.title}`} className="w-full max-w-72 rounded-[14px] shadow-sm" />
        {domain.playable && item.mediaUrl ? (
          <Button onClick={onPlay}>
            <Icon name={playing ? 'pause' : 'play'} />
            {playing ? 'Pausar' : 'Reproducir'}
          </Button>
        ) : null}
        {item.externalUrl && (
          <Button variant="secondary" asChild>
            <a href={item.externalUrl} target="_blank" rel="noreferrer">
              <Icon name="external" />
              Ver en {domain.source.name}
            </a>
          </Button>
        )}
        <SourceAttribution {...domain.source} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 [overflow-wrap:anywhere]">
        <div className="flex flex-col gap-1">
          <Heading>{item.title}</Heading>
          {item.subtitle && (
            <Text tone="muted">
              <span className="capitalize">{domain.creatorLabel}</span>: {item.subtitle}
            </Text>
          )}
          {meta && (
            <Text tone="muted" size="sm" font="mono">
              {meta}
            </Text>
          )}
          {sound && (
            <Text tone="muted" size="sm" className="flex items-center gap-1.5">
              <Icon name="activity" className="size-4 flex-none text-domain" />
              <span>
                <span className="font-mono">{sound}</span> · medido en tu dispositivo
              </span>
            </Text>
          )}
        </div>
        {item.description && <Text className="whitespace-pre-line">{item.description}</Text>}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
            {item.tags.slice(0, 10).map((t) => (
              <Chip key={t} variant="outline">
                {t.replaceAll('_', ' ').replaceAll('-', ' ')}
              </Chip>
            ))}
          </div>
        )}
        <TechSheet rows={sheet} source={domain.source.name + (item.domainId === 'music' || item.domainId === 'youtube' ? ' y MusicBrainz' : '')} />
        {scales.length > 0 && (
          <section className="flex flex-col gap-2.5" aria-label="Carácter">
            <Text font="label">Carácter</Text>
            {scales.map((a) => (
              <AttributeMeter key={a.key} label={a.label} value={item.attributes[a.key]} hint={`${a.lowLabel} ↔ ${a.highLabel}`} origin={originOf(measured, a.key)} />
            ))}
          </section>
        )}
        {similar && similar.length > 0 && (
          <section className="flex flex-col gap-1.5" aria-label="Parecidos">
            <Text font="label">Si te gusta, prueba también</Text>
            <ul className="flex flex-col gap-1">
              {similar.map((s) => (
                <li key={s.item.id}>
                  <ItemRow
                    title={s.item.title}
                    subtitle={s.item.subtitle}
                    imageUrl={s.item.imageUrl}
                    match={Math.round(s.similarity * 100)}
                    actionLabel="Ver la ficha de"
                    onSelect={() => onOpenSimilar?.(s.item)}
                    className="rounded-[12px] px-2 py-1"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
        <LearnMore links={links} loading={linksLoading} name={linksName} />
      </div>
    </div>
  )
}
