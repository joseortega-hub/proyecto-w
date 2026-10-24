import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ReviewCandidate } from './ReviewCandidate'

const meta = {
  title: 'Molecules/ReviewCandidate',
  component: ReviewCandidate,
  args: {
    item: { id: 'dei.v', name: 'Dei V', reason: 'nombre exacto pero pocos oyentes', listeners: 1500, tags: ['trap latino', 'urbano'], mbid: null, qid: null },
    onDecide: fn(),
  },
  decorators: [(Story) => <div data-domain="perreo" className="max-w-md p-4"><Story /></div>],
} satisfies Meta<typeof ReviewCandidate>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Busy: Story = { args: { busy: true } }
