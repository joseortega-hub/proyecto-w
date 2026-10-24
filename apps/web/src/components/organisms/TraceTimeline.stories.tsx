import type { Meta, StoryObj } from '@storybook/react-vite'
import { sampleRow } from '@/components/molecules/TraceStep.stories'
import { TraceTimeline } from './TraceTimeline'

const meta = { title: 'Organisms/TraceTimeline', component: TraceTimeline, decorators: [(Story) => <div className="max-w-md"><Story /></div>] } satisfies Meta<typeof TraceTimeline>
export default meta
type Story = StoryObj<typeof meta>

export const Interview: Story = {
  args: {
    rows: [
      { ...sampleRow, id: 'a' },
      { ...sampleRow, id: 'b', provider: 'laya', model: 'laya:multilingual', latencyMs: 1200, skipped: [{ provider: 'groq', reason: 'sin cupo', ms: 250 }] },
      { ...sampleRow, id: 'c', task: 'score+noul', provider: 'gemini', model: 'gemini-3.1-flash-lite', latencyMs: 2100, outcome: null },
      { ...sampleRow, id: 'd', task: 'text', provider: 'groq', model: 'qwen/qwen3.8-27b', latencyMs: 900, outcome: null },
    ],
  },
}
export const Empty: Story = { args: { rows: [] } }
