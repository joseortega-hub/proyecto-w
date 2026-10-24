import type { Meta, StoryObj } from '@storybook/react-vite'
import { ATTRIBUTES } from '@/lib/vibe/vibe-fixtures'
import { VibeDimension } from './VibeDimension'

const meta = {
  title: 'Molecules/VibeDimension',
  component: VibeDimension,
  args: { attribute: ATTRIBUTES.music[0], value: 0.15, source: 'text', solid: true, variant: 'eq' },
  decorators: [(Story) => <div className="w-[260px] p-4"><Story /></div>],
} satisfies Meta<typeof VibeDimension>
export default meta
type Story = StoryObj<typeof meta>

export const Ecualizador: Story = {}
export const EcualizadorSupuesto: Story = { args: { source: 'context', solid: false, value: 0.5 } }
export const Hud: Story = { args: { attribute: ATTRIBUTES.games[0], variant: 'hud', value: 0.9, source: 'answer' } }
export const Claqueta: Story = { args: { attribute: ATTRIBUTES.movies[0], variant: 'cine', value: 0.7, source: 'taste', solid: false } }
export const Marcapaginas: Story = { args: { attribute: ATTRIBUTES.books[1], variant: 'book', value: 0.3, source: 'you' } }
