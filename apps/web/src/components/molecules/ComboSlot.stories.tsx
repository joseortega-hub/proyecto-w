import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ComboSlot } from './ComboSlot'

const meta = {
  title: 'Molecules/ComboSlot',
  component: ComboSlot,
  args: {
    domainId: 'movies',
    icon: 'movies',
    name: 'Película',
    role: 'para ahora',
    why: 'Noche de sábado con lluvia: algo pausado',
    entries: [{ id: '1', title: 'Her', subtitle: 'Spike Jonze', imageUrl: null, reason: 'Dir. Spike Jonze (2013) · pausada y luminosa · va con tus gustos: ciencia ficción', onOpen: fn() }],
  },
  decorators: [(Story) => <div className="w-[350px] md:w-[460px]"><Story /></div>],
} satisfies Meta<typeof ComboSlot>
export default meta
type Story = StoryObj<typeof meta>

export const Movie: Story = {}
export const Music: Story = {
  args: {
    domainId: 'music',
    icon: 'music',
    name: 'Música',
    role: 'para después',
    entries: [
      { id: '1', title: 'Midnight Rain', subtitle: 'Luna Park', imageUrl: null, reason: 'De Luna Park · tranquila y acústica', onOpen: fn() },
      { id: '2', title: 'After Hours', subtitle: 'Nite Owl', imageUrl: null, reason: 'De Nite Owl · tranquila y melancólica', onOpen: fn() },
    ],
  },
}
