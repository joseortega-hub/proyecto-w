import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { SeekBar } from './SeekBar'

const meta = {
  title: 'Molecules/SeekBar',
  component: SeekBar,
  args: { position: 72, duration: 228, onSeek: () => undefined },
  decorators: [(Story) => <div className="w-[340px]"><Story /></div>],
} satisfies Meta<typeof SeekBar>
export default meta
type Story = StoryObj<typeof meta>

function InteractiveSeekBar({ duration = 228 }: { duration?: number }) {
  const [position, setPosition] = useState(72)
  return <SeekBar position={position} duration={duration} onSeek={setPosition} />
}

export const Interactive: Story = { render: (args) => <InteractiveSeekBar duration={args.duration} /> }
export const Unknown: Story = { args: { position: 0, duration: 0 } }
