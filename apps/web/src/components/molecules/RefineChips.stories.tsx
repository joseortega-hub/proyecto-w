import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { RefineChips } from './RefineChips'

const options = [
  { key: 'more-energy', label: '+ energía' },
  { key: 'more-calm', label: '+ calma' },
  { key: 'with-voice', label: 'con voz' },
  { key: 'instrumental', label: 'instrumental' },
]

const meta = {
  title: 'Molecules/RefineChips',
  component: RefineChips,
  args: { options, value: [], onChange: () => undefined },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof RefineChips>
export default meta
type Story = StoryObj<typeof meta>

function InteractiveChips(args: Story['args']) {
  const [value, setValue] = useState<string[]>(['with-voice'])
  return <RefineChips options={args?.options ?? options} value={value} onChange={setValue} />
}

export const Interactive: Story = { render: (args) => <InteractiveChips {...args} /> }
export const Disabled: Story = { args: { value: ['more-energy'], disabled: true } }
