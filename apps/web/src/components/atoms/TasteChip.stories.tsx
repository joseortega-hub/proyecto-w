import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { TasteChip, type TasteState } from './TasteChip'

const meta = {
  title: 'Atoms/TasteChip',
  component: TasteChip,
  args: { label: 'rol y aventura', state: 'none', onToggle: () => {} },
  decorators: [(Story) => <div data-domain="games">{Story()}</div>],
} satisfies Meta<typeof TasteChip>
export default meta
type Story = StoryObj<typeof meta>

export const SinMarcar: Story = {}
export const MeGusta: Story = { args: { state: 'like' } }
export const NoMeGusta: Story = { args: { state: 'dislike', label: 'terror y supervivencia' } }

/** Toca para pasar por los tres estados. */
export const Interactivo: Story = {
  render: (args) => {
    const [state, setState] = useState<TasteState>('none')
    const next: Record<TasteState, TasteState> = { none: 'like', like: 'dislike', dislike: 'none' }
    return <TasteChip {...args} state={state} onToggle={() => setState(next[state])} />
  },
}
