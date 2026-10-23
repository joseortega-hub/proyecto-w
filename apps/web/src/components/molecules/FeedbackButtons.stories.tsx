import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { Feedback } from '@/lib/api'
import { FeedbackButtons } from './FeedbackButtons'

const meta = {
  title: 'Molecules/FeedbackButtons',
  component: FeedbackButtons,
  args: { title: 'The Witcher 3: Wild Hunt', value: null, onChange: () => {} },
  decorators: [(Story) => <div data-domain="games">{Story()}</div>],
} satisfies Meta<typeof FeedbackButtons>
export default meta
type Story = StoryObj<typeof meta>

export const SinValorar: Story = {}
export const MeGusta: Story = { args: { value: 'up' } }
export const NoEsParaMi: Story = { args: { value: 'down' } }

export const Interactivo: Story = {
  render: (args) => {
    const [value, setValue] = useState<Feedback | null>(null)
    return <FeedbackButtons {...args} value={value} onChange={setValue} />
  },
}
