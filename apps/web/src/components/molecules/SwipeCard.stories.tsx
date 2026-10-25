import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CSSProperties } from 'react'
import { Button, Icon } from '@/components/atoms'
import { SwipeCard } from './SwipeCard'

const meta = {
  title: 'Molecules/SwipeCard',
  component: SwipeCard,
  args: {
    title: 'Noche de neón',
    subtitle: 'Luna Tropical',
    detail: '2024 · 3:42',
    match: 92,
    reason: 'Tiene el ritmo alegre y bailable que buscabas para esta noche.',
  },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
} satisfies Meta<typeof SwipeCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    actions: (
      <Button variant="secondary" className="flex-1">
        <Icon name="play" /> Escuchar
      </Button>
    ),
  },
}

/** Una parecida pedida al acabarse la pila: todavía no está en la lista. */
export const NuevaPropuesta: Story = {
  args: { inList: false, reason: 'Se parece a «Calle vacía», que te ha gustado.', likes: ['dembow', 'romántico'] },
}

/** Lo que se ve a mitad de gesto hacia la derecha (la marca se enciende con `--like`). */
export const ArrastrandoMeGusta: Story = { args: { style: { '--like': 0.9, transform: 'translate(60px, 0) rotate(3deg)' } as CSSProperties } }

export const ArrastrandoNo: Story = { args: { style: { '--nope': 0.9, transform: 'translate(-60px, 0) rotate(-3deg)' } as CSSProperties } }
