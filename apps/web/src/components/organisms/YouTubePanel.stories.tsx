import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { YouTubeStatus } from '@/lib/api'
import { YouTubePanel } from './YouTubePanel'

const base: YouTubeStatus = {
  configured: true,
  status: 'connected',
  channelTitle: 'Jose',
  connectedAt: '2026-10-24T10:00:00Z',
  expiresAt: '2026-10-31T10:00:00Z',
  itemCount: 184,
  import: null,
}
const job = { found: 184, added: 184, analyzed: 0, embedded: 0, pending: 0, quotaUnits: 23, startedAt: '2026-10-24T10:00:00Z' }

const meta = {
  title: 'Organisms/YouTubePanel',
  component: YouTubePanel,
  decorators: [(Story) => <div data-domain="youtube" className="max-w-md"><Story /></div>],
  args: { status: base, onConnect: fn(), onImport: fn(), onDisconnect: fn() },
} satisfies Meta<typeof YouTubePanel>
export default meta
type Story = StoryObj<typeof meta>

export const Disconnected: Story = { args: { status: { ...base, status: 'disconnected', channelTitle: null, itemCount: 0 } } }
export const Importing: Story = {
  args: { status: { ...base, import: { ...job, status: 'running', step: 'Analizando tus canciones con IA (60/184)', analyzed: 60 } } },
}
export const DoneWithPending: Story = {
  args: { status: { ...base, import: { ...job, status: 'done', step: 'Listo', analyzed: 184, embedded: 120, pending: 64 } } },
}
export const Expired: Story = { args: { status: { ...base, status: 'expired' } } }
export const Loading: Story = { args: { status: undefined } }
