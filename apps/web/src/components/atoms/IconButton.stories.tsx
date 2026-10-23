import type { Meta, StoryObj } from '@storybook/react-vite'
import { IconButton } from './IconButton'

const meta = {
  title: 'Atoms/IconButton',
  component: IconButton,
  args: { icon: 'undo', label: 'Deshacer la última respuesta' },
} satisfies Meta<typeof IconButton>
export default meta
type Story = StoryObj<typeof meta>

export const Subtle: Story = {}
export const Primary: Story = { args: { icon: 'play', label: 'Reproducir', variant: 'primary', size: 'lg' } }
export const Accent: Story = { args: { icon: 'play', label: 'Abrir la lista', variant: 'accent' } }
export const Disabled: Story = { args: { disabled: true } }
