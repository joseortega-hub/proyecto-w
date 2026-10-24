import type { Meta, StoryObj } from '@storybook/react-vite'
import type { TraceSummary } from '@/lib/ops-types'
import { SummaryPanel } from './SummaryPanel'

const summary: TraceSummary = {
  calls: 18,
  failed: 0,
  fallbackPct: 22,
  medianMs: 480,
  p95Ms: 2100,
  byProvider: [
    { provider: 'groq', calls: 11, medianMs: 410, p95Ms: 900 },
    { provider: 'laya', calls: 4, medianMs: 1200, p95Ms: 1500 },
    { provider: 'gemini', calls: 3, medianMs: 2000, p95Ms: 2100 },
  ],
  listCostEur: 0.0042,
  paidEur: 0,
  inputTokens: 9100,
  outputTokens: 1300,
}

const meta = {
  title: 'Organisms/SummaryPanel',
  component: SummaryPanel,
  args: { summary },
  decorators: [(Story) => <div data-domain="music" className="max-w-2xl"><Story /></div>],
} satisfies Meta<typeof SummaryPanel>
export default meta
type Story = StoryObj<typeof meta>

export const Free: Story = {}
export const WithPaidProvider: Story = { args: { summary: { ...summary, paidEur: 0.0031 } } }
export const Empty: Story = { args: { summary: { ...summary, calls: 0, byProvider: [], medianMs: 0, p95Ms: 0, fallbackPct: 0, listCostEur: 0 } } }
