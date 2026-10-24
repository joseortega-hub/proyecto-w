import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProviderChip } from './ProviderChip'

const meta = { title: 'Atoms/ProviderChip', component: ProviderChip, args: { provider: 'groq' } } satisfies Meta<typeof ProviderChip>
export default meta
type Story = StoryObj<typeof meta>

export const Groq: Story = {}
export const Failed: Story = { args: { failed: true } }
export const All: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {['groq', 'laya', 'gemini', 'cerebras', 'openrouter', 'jev'].map((p) => (
        <ProviderChip key={p} provider={p} />
      ))}
    </div>
  ),
}
