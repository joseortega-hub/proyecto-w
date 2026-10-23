import type { Meta, StoryObj } from '@storybook/react-vite'
import { Explanation } from './Explanation'

const meta = {
  title: 'Molecules/Explanation',
  component: Explanation,
  args: { reason: 'Es instrumental y lenta, como pediste para concentrarte.' },
  decorators: [(Story) => <div className="w-[340px]"><Story /></div>],
} satisfies Meta<typeof Explanation>
export default meta
type Story = StoryObj<typeof meta>

export const Collapsed: Story = {}
export const Open: Story = { args: { defaultOpen: true } }
export const Static: Story = { args: { collapsible: false, label: 'Por qué suena' } }
