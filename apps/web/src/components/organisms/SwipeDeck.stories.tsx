import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { fn } from 'storybook/test'
import { Button, Icon } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import type { ResultEntry } from '@/lib/api'
import { SwipeDeck } from './SwipeDeck'

const entry = (n: number, title: string, reason: string): ResultEntry => ({
  match: 92 - n * 5,
  fit: 0.9,
  reason,
  item: { id: `i${n}`, domainId: 'movies', source: 'tmdb', externalId: `${n}`, title, subtitle: 'Ciencia ficción · 2014', description: null, imageUrl: null, mediaUrl: null, externalUrl: 'https://www.themoviedb.org', durationSec: 9840, attributes: {}, tags: [], popularity: 0 },
})
const cards = [
  entry(0, 'Interstellar', 'Una historia épica y emotiva, como pediste para esta noche.'),
  entry(1, 'Arrival', 'Ciencia ficción pausada que te hace pensar.'),
  entry(2, 'Gravity', 'Tensión de principio a fin, en menos de dos horas.'),
]
const actions = (e: ResultEntry) => (
  <Button variant="secondary" className="flex-1" asChild>
    <a href={e.item.externalUrl ?? '#'} target="_blank" rel="noreferrer">
      <Icon name="external" /> Ver en TMDB
    </a>
  </Button>
)

const meta = {
  title: 'Organisms/SwipeDeck',
  component: SwipeDeck,
  args: { cards, onGesture: fn(), actions },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
} satisfies Meta<typeof SwipeDeck>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

function Interactive(args: ComponentProps<typeof SwipeDeck>) {
  const [done, setDone] = useState<{ id: string; verdict: string }[]>([])
  const left = cards.filter((c) => !done.some((d) => d.id === c.item.id))
  return (
    <SwipeDeck
      {...args}
      cards={left}
      lastVerdict={done.at(-1)?.verdict === 'nope' ? 'nope' : 'like'}
      onGesture={(gesture, e) => gesture !== 'detail' && setDone((d) => [...d, { id: e.item.id, verdict: gesture }])}
      onUndo={done.length ? () => setDone((d) => d.slice(0, -1)) : undefined}
      empty={<EmptyState icon="check" title="Ya lo has visto todo" action={<Button onClick={() => setDone([])}>Repasar otra vez</Button>} />}
    />
  )
}

/** Pruébalo: arrastra la tarjeta, usa los botones o las flechas del teclado; «Deshacer» la recupera. */
export const Interactivo: Story = { render: (args) => <Interactive {...args} /> }

export const BuscandoMas: Story = { args: { cards: [], loading: true } }

export const SinTarjetas: Story = { args: { cards: [], empty: <EmptyState icon="check" title="Ya lo has visto todo" /> } }
