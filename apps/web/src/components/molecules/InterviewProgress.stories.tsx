import type { Meta, StoryObj } from '@storybook/react-vite'
import { InterviewProgress } from './InterviewProgress'

const meta = {
  title: 'Molecules/InterviewProgress',
  component: InterviewProgress,
  args: { confidence: 0.58 },
  argTypes: { confidence: { control: { type: 'range', min: 0, max: 1, step: 0.01 } } },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof InterviewProgress>
export default meta
type Story = StoryObj<typeof meta>

export const Start: Story = { args: { confidence: 0.1 } }
export const Halfway: Story = {}
export const Ready: Story = { args: { confidence: 0.91 } }
