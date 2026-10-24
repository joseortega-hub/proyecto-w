import type { Meta, StoryObj } from '@storybook/react-vite'
import { FreeReplyField } from './FreeReplyField'

const meta = {
  title: 'Molecules/FreeReplyField',
  component: FreeReplyField,
  args: { onSend: () => {} },
  decorators: [(Story) => <div data-domain="movies" className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof FreeReplyField>
export default meta
type Story = StoryObj<typeof meta>

export const ConMicrofono: Story = { args: { speech: true } }
export const SinMicrofono: Story = { args: { speech: false } }
export const Pensando: Story = { args: { speech: true, disabled: true } }
