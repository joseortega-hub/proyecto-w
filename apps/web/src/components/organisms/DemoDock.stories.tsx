import type { Meta, StoryObj } from '@storybook/react-vite'
import { sampleRow } from '@/components/molecules/TraceStep.stories'
import { DemoDock } from './DemoDock'

const meta = {
  title: 'Organisms/DemoDock',
  component: DemoDock,
  parameters: { layout: 'fullscreen' },
  args: { onClose: () => {}, rows: [] },
} satisfies Meta<typeof DemoDock>
export default meta
type Story = StoryObj<typeof meta>

export const Waiting: Story = {}
export const Live: Story = {
  args: {
    rows: [
      { ...sampleRow, id: 'a' },
      { ...sampleRow, id: 'b', provider: 'laya', model: 'laya:multilingual', latencyMs: 1200, skipped: [{ provider: 'groq', reason: 'sin cupo', ms: 250 }] },
    ],
  },
}

/** Móvil en horizontal (667×375): el panel deja sitio al contenido y respeta la zona segura inferior. */
export const MovilHorizontal: Story = {
  ...Live,
  globals: { viewport: { value: 'horizontal', isRotated: false } },
}
