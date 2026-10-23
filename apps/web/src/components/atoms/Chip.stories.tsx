import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip } from './Chip'

const meta = {
  title: 'Atoms/Chip',
  component: Chip,
  args: { children: 'tranquila' },
} satisfies Meta<typeof Chip>
export default meta
type Story = StoryObj<typeof meta>

export const Solid: Story = {}
export const Guess: Story = { args: { variant: 'guess', children: '¿instrumental?' } }
export const Outline: Story = { args: { variant: 'outline', children: '+ energía' } }
