import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import type { ResultLayout } from '@/lib/swipe'
import { LayoutSwitch } from './LayoutSwitch'

const meta = {
  title: 'Molecules/LayoutSwitch',
  component: LayoutSwitch,
  args: { value: 'list', onChange: () => {} },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
} satisfies Meta<typeof LayoutSwitch>

export default meta
type Story = StoryObj<typeof meta>

export const Lista: Story = {}

export const Desliza: Story = { args: { value: 'swipe' } }

function Interactive(args: ComponentProps<typeof LayoutSwitch>) {
  const [value, setValue] = useState<ResultLayout>('list')
  return <LayoutSwitch {...args} value={value} onChange={setValue} />
}

export const Interactivo: Story = { render: (args) => <Interactive {...args} /> }
