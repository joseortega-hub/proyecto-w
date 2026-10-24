import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { FameSlider } from './FameSlider'

const meta = {
  title: 'Molecules/FameSlider',
  component: FameSlider,
  args: { min: 0, max: 100, onChange: () => undefined },
  decorators: [(Story) => <div data-domain="perreo" className="w-[350px]"><Story /></div>],
  render: (args) => {
    const [range, setRange] = useState({ min: args.min, max: args.max })
    return <FameSlider min={range.min} max={range.max} onChange={setRange} />
  },
} satisfies Meta<typeof FameSlider>
export default meta
type Story = StoryObj<typeof meta>

export const Everything: Story = {}
export const OnlyUnderground: Story = { args: { min: 0, max: 30 } }
export const OnlyMainstream: Story = { args: { min: 70, max: 100 } }
