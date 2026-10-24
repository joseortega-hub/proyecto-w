import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProviderCompare } from './ProviderCompare'

const result = {
  question: 'Elige la siguiente pregunta',
  rows: [
    { provider: 'groq', ok: true, choice: 'voice', label: '¿Con voz?', confidence: 0.8, latencyMs: 410, agrees: true, error: null },
    { provider: 'laya', ok: true, choice: 'voice', label: '¿Con voz?', confidence: 0.64, latencyMs: 1250, agrees: true, error: null },
    { provider: 'gemini', ok: true, choice: 'energy', label: '¿Algo con energía?', confidence: 0.55, latencyMs: 2100, agrees: false, error: null },
    { provider: 'cerebras', ok: false, choice: null, label: null, confidence: null, latencyMs: 8000, agrees: null, error: 'timeout' },
  ],
}

const meta = {
  title: 'Organisms/ProviderCompare',
  component: ProviderCompare,
  args: { result: null, running: false, waitSec: 0, onRun: () => {} },
  decorators: [(Story) => <div className="max-w-2xl"><Story /></div>],
} satisfies Meta<typeof ProviderCompare>
export default meta
type Story = StoryObj<typeof meta>

export const Ready: Story = {}
export const Running: Story = { args: { running: true } }
export const WithResult: Story = { args: { result, waitSec: 24 } }
export const NothingToCompare: Story = { args: { disabled: true } }
export const RateLimited: Story = { args: { error: 'Espera 12 s: cuido el cupo gratuito', waitSec: 12 } }
