import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FolderConnectCard } from './FolderConnectCard'

const meta = {
  title: 'Molecules/FolderConnectCard',
  component: FolderConnectCard,
  decorators: [(Story) => <div data-domain="folder" className="max-w-md"><Story /></div>],
  args: { access: 'none', onChoose: fn(), onReconnect: fn(), onImport: fn(), onReview: fn(), onForget: fn() },
} satisfies Meta<typeof FolderConnectCard>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}
export const NoRemember: Story = { args: { canRemember: false } }
export const Ready: Story = { args: { access: 'ready', folderName: 'Reguetón', found: 412, itemCount: 380, review: 7 } }
export const NeedsPermission: Story = { args: { access: 'needs-permission', folderName: 'Reguetón', itemCount: 380 } }
