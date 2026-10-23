import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ItemCard } from './ItemCard'

const meta = {
  title: 'Molecules/ItemCard',
  component: ItemCard,
  args: { title: 'Hollow Knight', subtitle: 'Team Cherry', meta: '2017', onSelect: fn() },
  decorators: [(Story) => <div className="w-[170px]"><Story /></div>],
} satisfies Meta<typeof ItemCard>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const LongTitle: Story = {
  args: { title: 'The Elder Scrolls V: Skyrim Special Edition Anniversary', subtitle: 'Bethesda Game Studios, un estudio con nombre largo' },
}
export const WithoutMeta: Story = { args: { meta: null } }
