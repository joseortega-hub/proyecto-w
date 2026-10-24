import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { FolderTrackRow } from './FolderTrackRow'

const meta = {
  title: 'Molecules/FolderTrackRow',
  component: FolderTrackRow,
  decorators: [(Story) => <div data-domain="folder" className="max-w-md"><Story /></div>],
  args: { title: 'Monaco', artist: 'Bad Bunny', onSave: fn() },
} satisfies Meta<typeof FolderTrackRow>
export default meta
type Story = StoryObj<typeof meta>

export const Confirmed: Story = {}
export const ToReview: Story = { args: { review: true, title: 'tema raro 2', artist: null } }
