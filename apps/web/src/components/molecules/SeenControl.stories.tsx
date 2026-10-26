import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { SeenRating } from '@/lib/api'
import { seenWords } from '@/lib/seen'
import { SeenControl } from './SeenControl'

const meta = {
  title: 'Molecules/SeenControl',
  component: SeenControl,
  args: { title: 'Arrival', words: seenWords('movies'), rating: undefined, onChange: () => {} },
  decorators: [(Story) => <div data-domain="movies">{Story()}</div>],
} satisfies Meta<typeof SeenControl>
export default meta
type Story = StoryObj<typeof meta>

export const SinMarcar: Story = {}
export const Compacto: Story = { args: { compact: true } }
export const MarcadaSinValorar: Story = { args: { rating: null } }
export const MeEncanto: Story = { args: { rating: 'loved' } }
export const Libro: Story = { args: { title: 'Rayuela', words: seenWords('books'), rating: 'meh' } }

export const Interactivo: Story = {
  render: (args) => {
    const [rating, setRating] = useState<SeenRating | null | undefined>(undefined)
    return <SeenControl {...args} rating={rating} onChange={(n) => setRating(n.seen ? n.rating : undefined)} />
  },
}
