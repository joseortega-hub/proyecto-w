import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { AnswerPair } from './AnswerPair'

const meta = {
  title: 'Molecules/AnswerPair',
  component: AnswerPair,
  args: { onAnswer: fn() },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof AnswerPair>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Thinking: Story = { args: { disabled: true } }
