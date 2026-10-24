import type { Meta, StoryObj } from '@storybook/react-vite'
import { CountBars } from './CountBars'

const meta = {
  title: 'Molecules/CountBars',
  component: CountBars,
  args: {
    items: [
      { label: 'Nintendo', count: 7 },
      { label: 'Valve', count: 4 },
      { label: 'Team Cherry', count: 2 },
    ],
  },
  decorators: [(Story) => <div data-domain="games" className="w-[320px]"><Story /></div>],
} satisfies Meta<typeof CountBars>
export default meta
type Story = StoryObj<typeof meta>

export const Creators: Story = {}
export const Genres: Story = { args: { items: [{ label: 'rol y aventura', count: 9 }, { label: 'casuales y relajados', count: 5 }], unit: 'elementos' } }
