import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { UniversalBar } from './UniversalBar'

const meta = {
  title: 'Molecules/UniversalBar',
  component: UniversalBar,
  args: { value: '', onChange: fn(), onSubmit: fn(), speech: true },
  decorators: [(Story) => <div className="w-[350px] md:w-[520px]"><Story /></div>],
} satisfies Meta<typeof UniversalBar>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}
export const WithText: Story = { args: { value: 'algo de Marvel' } }
export const Detecting: Story = { args: { value: 'un juego tipo Pokémon', busy: true } }
export const WithoutMic: Story = { args: { speech: false } }
export const Interactive: Story = {
  render: (args) => {
    const [value, setValue] = useState('')
    return <UniversalBar {...args} value={value} onChange={setValue} />
  },
}
