import type { Meta, StoryObj } from '@storybook/react-vite'
import { DragHandle } from './DragHandle'

const meta = { title: 'Atoms/DragHandle', component: DragHandle, args: { label: 'Mover Despacito' } } satisfies Meta<typeof DragHandle>
export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {}
export const Grabbed: Story = { args: { active: true } }
