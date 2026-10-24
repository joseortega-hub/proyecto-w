import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { YouTubeConnectCard } from './YouTubeConnectCard'

const meta = {
  title: 'Molecules/YouTubeConnectCard',
  component: YouTubeConnectCard,
  decorators: [(Story) => <div data-domain="youtube" className="max-w-md"><Story /></div>],
  args: { status: 'disconnected', onConnect: fn(), onImport: fn(), onDisconnect: fn() },
} satisfies Meta<typeof YouTubeConnectCard>
export default meta
type Story = StoryObj<typeof meta>

export const Disconnected: Story = {}
export const Connected: Story = {
  args: { status: 'connected', channelTitle: 'Jose', itemCount: 184, expiresAt: '2026-10-31T10:00:00Z' },
}
export const Expired: Story = { args: { status: 'expired', channelTitle: 'Jose', itemCount: 184 } }
export const Unavailable: Story = { args: { unavailable: true } }
