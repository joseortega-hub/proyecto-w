import type { Meta, StoryObj } from '@storybook/react-vite'
import { VibeSourceIcon, type VibeSourceKey } from './VibeSourceIcon'

const meta = { title: 'Atoms/VibeSourceIcon', component: VibeSourceIcon, args: { source: 'text' } } satisfies Meta<typeof VibeSourceIcon>
export default meta
type Story = StoryObj<typeof meta>

const ALL: VibeSourceKey[] = ['text', 'answer', 'taste', 'context', 'guess', 'you']

export const Solido: Story = {
  render: () => (
    <div className="flex gap-2">
      {ALL.map((s) => (
        <VibeSourceIcon key={s} source={s} />
      ))}
    </div>
  ),
}
export const Punteado: Story = {
  render: () => (
    <div className="flex gap-2">
      {ALL.map((s) => (
        <VibeSourceIcon key={s} source={s} solid={false} />
      ))}
    </div>
  ),
}
