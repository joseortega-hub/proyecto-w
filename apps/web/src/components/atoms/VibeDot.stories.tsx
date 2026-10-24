import type { Meta, StoryObj } from '@storybook/react-vite'
import { vibeGradient } from '@/lib/vibe/vibe-color'
import { VibeDot } from './VibeDot'

const meta = {
  title: 'Atoms/VibeDot',
  component: VibeDot,
  args: { label: 'sábado 24 · Lluvia y cascos puestos', gradient: vibeGradient(0.2, 0.3).css },
  decorators: [(Story) => <div className="w-8"><Story /></div>],
} satisfies Meta<typeof VibeDot>
export default meta
type Story = StoryObj<typeof meta>

export const Rainy: Story = {}
export const Party: Story = { args: { label: 'viernes 23 · Ganas de guerra', gradient: vibeGradient(0.95, 0.95).css } }
export const Empty: Story = { args: { gradient: null, label: 'lunes 19 · sin lista' } }
export const Future: Story = { args: { hidden: true } }
