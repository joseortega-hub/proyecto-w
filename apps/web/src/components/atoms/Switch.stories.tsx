import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Switch } from './Switch'

function Controlled(args: React.ComponentProps<typeof Switch>) {
  const [on, setOn] = useState(false)
  return <Switch {...args} checked={on} onCheckedChange={setOn} />
}

const meta = { title: 'Atoms/Switch', component: Switch, args: { label: 'Modo demo', checked: false, onCheckedChange: () => {} } } satisfies Meta<typeof Switch>
export default meta
type Story = StoryObj<typeof meta>

export const Off: Story = {}
export const On: Story = { args: { checked: true } }
export const Interactive: Story = {
  render: (args) => <Controlled {...args} />,
}
