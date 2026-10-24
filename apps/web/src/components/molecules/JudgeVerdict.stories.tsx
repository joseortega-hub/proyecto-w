import type { Meta, StoryObj } from '@storybook/react-vite'
import { JudgeVerdict } from './JudgeVerdict'

const meta = {
  title: 'Molecules/JudgeVerdict',
  component: JudgeVerdict,
  args: { score: 4, reason: 'La lista mantiene el ritmo alto y la voz que pidió, salvo un tema más calmado.', judge: 'groq' },
} satisfies Meta<typeof JudgeVerdict>
export default meta
type Story = StoryObj<typeof meta>

export const Good: Story = {}
export const Poor: Story = { args: { score: 2, reason: 'Casi todo es instrumental y pidió voz.' } }
