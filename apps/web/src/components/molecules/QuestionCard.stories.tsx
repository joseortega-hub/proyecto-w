import type { Meta, StoryObj } from '@storybook/react-vite'
import { QuestionCard } from './QuestionCard'

const meta = {
  title: 'Molecules/QuestionCard',
  component: QuestionCard,
  args: {
    question: '¿Quieres que la música tenga voz?',
    reason: 'Lo pregunto porque dijiste que es para concentrarte.',
  },
  decorators: [(Story) => <div className="w-[350px] md:w-[520px]"><Story /></div>],
} satisfies Meta<typeof QuestionCard>
export default meta
type Story = StoryObj<typeof meta>

export const Mobile: Story = {}
export const Framed: Story = { args: { framed: true } }
export const Loading: Story = { args: { loading: true } }
export const WithoutReason: Story = { args: { reason: undefined } }
