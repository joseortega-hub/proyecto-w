import type { Meta, StoryObj } from '@storybook/react-vite'
import { Dial } from './Dial'

const meta = {
  title: 'Atoms/Dial',
  component: Dial,
  args: { value: 0.44 },
  argTypes: { value: { control: { type: 'range', min: 0, max: 1, step: 0.01 } } },
  decorators: [(Story) => <div className="w-80"><Story /></div>],
} satisfies Meta<typeof Dial>
export default meta
type Story = StoryObj<typeof meta>

export const Start: Story = { args: { value: 0.1 } }
export const Halfway: Story = {}
export const Confident: Story = { args: { value: 0.91 } }
