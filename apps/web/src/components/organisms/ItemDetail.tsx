import { Button, Chip, Cover, Heading, Icon, Text } from '@/components/atoms'
import { AttributeMeter, ItemRow, SourceAttribution } from '@/components/molecules'
import type { Attribute, DomainInfo, Item } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import { itemYear } from './ItemGrid'

interface ItemDetailProps {
  item: Item
  domain: Pick<DomainInfo, 'creatorLabel' | 'playable' | 'source' | 'itemNounPlural'>
  attributes: Attribute[]
  similar?: { similarity: number; item: Item }[]
  playing?: boolean
  onPlay?: () => void
  onOpenSimilar?: (item: Item) => void
}

/**
 * Ficha de un elemento. En música se reproduce aquí; en el resto de temáticas no hay
 * contenido que reproducir, así que se enlaza a la fuente con su atribución.
 */
export function ItemDetail({ item, domain, attributes, similar, playing, onPlay, onOpenSimilar }: ItemDetailProps) {
  const scales = attributes.filter((a) => a.kind === 'scale' && item.attributes[a.key] !== undefined)
  const meta = [itemYear(item), item.durationSec ? formatDuration(item.durationSec) : null].filter(Boolean).join(' · ')
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
      <div className="flex min-w-0 flex-1 flex-col gap-4">
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
        {scales.length > 0 && (
          <section className="flex flex-col gap-2.5" aria-label="Carácter">
            <Text font="label">Carácter</Text>
            {scales.map((a) => (
              <AttributeMeter key={a.key} label={a.label} value={item.attributes[a.key]} hint={`${a.lowLabel} ↔ ${a.highLabel}`} />
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
      </div>
    </div>
  )
}
