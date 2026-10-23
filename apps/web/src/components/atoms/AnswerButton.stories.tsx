import type { Meta, StoryObj } from '@storybook/react-vite'
import { AnswerButton } from './AnswerButton'

const meta = {
  title: 'Atoms/AnswerButton',
  component: AnswerButton,
  args: { answer: 'yes' },
  decorators: [(Story) => <div className="w-40"><Story /></div>],
} satisfies Meta<typeof AnswerButton>
export default meta
type Story = StoryObj<typeof meta>

export const Yes: Story = {}
export const No: Story = { args: { answer: 'no' } }
export const Disabled: Story = { args: { disabled: true } }
