import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'

const meta = {
  title: 'Atoms/Button',
  component: Button,
  args: { children: 'Empezar' },
  argTypes: { variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] }, size: { control: 'inline-radio', options: ['md', 'lg'] } },
} satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {}
export const Secondary: Story = { args: { variant: 'secondary', children: 'Explorar la biblioteca' } }
export const Ghost: Story = { args: { variant: 'ghost', size: 'md', children: 'Empezar de nuevo' } }
export const Disabled: Story = { args: { disabled: true } }
