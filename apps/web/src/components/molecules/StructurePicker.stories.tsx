import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { LayoutId } from '@/lib/layout'
import { StructurePicker } from './StructurePicker'

const meta = {
  title: 'Molecules/StructurePicker',
  component: StructurePicker,
  args: { value: 'app', onChange: () => undefined },
  decorators: [(Story) => <div className="w-[320px]"><Story /></div>],
} satisfies Meta<typeof StructurePicker>
export default meta
type Story = StoryObj<typeof meta>

function Interactive() {
  const [value, setValue] = useState<LayoutId>('dock')
  return <StructurePicker value={value} onChange={setValue} />
}

export const Default: Story = { render: () => <Interactive /> }
export const Library: Story = { args: { value: 'library' } }
export const UnaMano: Story = { args: { value: 'thumb' } }
export const Enfoque: Story = { args: { value: 'focus' } }
