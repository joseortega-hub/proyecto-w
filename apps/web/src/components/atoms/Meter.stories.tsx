import type { Meta, StoryObj } from '@storybook/react-vite'
import { Meter } from './Meter'

const meta = {
  title: 'Atoms/Meter',
  component: Meter,
  args: { value: 0.65, label: 'Positividad' },
  argTypes: { value: { control: { type: 'range', min: 0, max: 1, step: 0.05 } } },
  decorators: [(Story) => <div className="w-64"><Story /></div>],
} satisfies Meta<typeof Meter>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { value: 0 } }
export const Full: Story = { args: { value: 1 } }
