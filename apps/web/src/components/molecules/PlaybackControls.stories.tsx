import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PlaybackControls } from './PlaybackControls'

const meta = {
  title: 'Molecules/PlaybackControls',
  component: PlaybackControls,
  args: { playing: false, onToggle: fn(), onPrevious: fn(), onNext: fn() },
} satisfies Meta<typeof PlaybackControls>
export default meta
type Story = StoryObj<typeof meta>

export const Paused: Story = {}
export const Playing: Story = { args: { playing: true } }
export const FirstTrack: Story = { args: { hasPrevious: false } }
