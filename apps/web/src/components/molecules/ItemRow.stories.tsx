import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { Explanation } from './Explanation'
import { ItemRow } from './ItemRow'

const meta = {
  title: 'Molecules/ItemRow',
  component: ItemRow,
  args: { title: 'Marea lenta', subtitle: 'Lumen Drift', durationSec: 228, match: 94, onSelect: fn() },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof ItemRow>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Playing: Story = { args: { active: true, playing: true } }
export const Paused: Story = { args: { active: true, playing: false } }
export const WithoutMatch: Story = { args: { match: undefined, subtitle: '12 canciones · hace 2 días', durationSec: null } }
export const WithExplanation: Story = {
  args: {
    className: 'rounded-[14px] border border-border bg-card p-3',
    children: <Explanation reason="Instrumental, tempo lento (84 BPM) y tono cálido. Acompaña sin distraer." defaultOpen />,
  },
}
export const OpensDetail: Story = {
  args: { title: 'Hollow Knight', subtitle: 'Team Cherry', durationSec: null, match: 91, actionLabel: 'Ver la ficha de' },
}
export const LongTitle: Story = {
  args: { title: 'Quand je serai grand (versión instrumental remasterizada en 2024)', subtitle: 'Un artista con un nombre también muy largo' },
}
