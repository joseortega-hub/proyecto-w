import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TraceRow } from '@/lib/ops-types'
import { TraceStep } from './TraceStep'

export const sampleRow: TraceRow = {
  id: '1',
  at: '2026-10-24T09:30:00Z',
  task: 'choice',
  subject: 'next',
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  ok: true,
  skipped: [],
  latencyMs: 420,
  totalMs: 420,
  inputTokens: 612,
  outputTokens: 84,
  listCostEur: 0.00015,
  free: true,
  outcome: 'energy-high',
}

const meta = {
  title: 'Molecules/TraceStep',
  component: TraceStep,
  args: { row: sampleRow },
  decorators: [
    (Story) => (
      <ul className="max-w-md">
        <Story />
      </ul>
    ),
  ],
} satisfies Meta<typeof TraceStep>
export default meta
type Story = StoryObj<typeof meta>

export const Direct: Story = {}
export const WithFallback: Story = {
  args: {
    row: { ...sampleRow, provider: 'laya', model: 'laya:multilingual', latencyMs: 1200, totalMs: 1450, skipped: [{ provider: 'groq', reason: 'sin cupo', ms: 250 }] },
  },
}
export const AllFailed: Story = {
  args: {
    row: {
      ...sampleRow,
      ok: false,
      provider: null,
      totalMs: 9000,
      skipped: [
        { provider: 'groq', reason: 'timeout', ms: 5000 },
        { provider: 'gemini', reason: 'saturado', ms: 4000 },
      ],
    },
  },
}
export const Compact: Story = { args: { compact: true } }
