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
export const WithModes: Story = { args: { shuffle: true, repeat: 'all', onShuffle: fn(), onRepeat: fn() } }
export const RepeatOne: Story = { args: { repeat: 'one', onShuffle: fn(), onRepeat: fn() } }
export const FirstTrack: Story = { args: { hasPrevious: false } }
