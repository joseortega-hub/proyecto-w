import type { Meta, StoryObj } from '@storybook/react-vite'
import { AttributeMeter } from './AttributeMeter'

const meta = {
  title: 'Molecules/AttributeMeter',
  component: AttributeMeter,
  args: { label: 'Concentración', value: 0.85 },
  decorators: [(Story) => <div className="w-[330px]"><Story /></div>],
} satisfies Meta<typeof AttributeMeter>
export default meta
type Story = StoryObj<typeof meta>

export const High: Story = {}
export const Low: Story = { args: { label: 'Voz', value: 0.08 } }
