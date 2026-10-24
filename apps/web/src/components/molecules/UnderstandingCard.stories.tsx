import type { Meta, StoryObj } from '@storybook/react-vite'
import { UnderstandingCard } from './UnderstandingCard'

const meta = {
  title: 'Molecules/UnderstandingCard',
  component: UnderstandingCard,
  args: { chips: null, onRemove: () => {}, onChange: () => {}, onStart: () => {} },
} satisfies Meta<typeof UnderstandingCard>

export default meta
type Story = StoryObj<typeof meta>

/** Mientras se lee el texto. */
export const Reading: Story = {}

export const Understood: Story = {
  args: {
    chips: [
      { id: 'mood:depth', icon: '😴', label: 'para desconectar' },
      { id: 'anchor:Marvel', icon: '🎯', label: 'Marvel' },
      {
        id: 'pref:platforms',
        icon: '🎮',
        label: 'Dónde juegas',
        value: 'nintendo',
        options: [
          { value: 'pc', label: 'PC' },
          { value: 'nintendo', label: 'Nintendo' },
          { value: 'any', label: 'Me da igual' },
        ],
      },
      { id: 'out:horror', icon: '🚫', label: 'terror' },
    ],
  },
}

export const NothingConcrete: Story = { args: { chips: [] } }
