import type { Meta, StoryObj } from '@storybook/react-vite'
import { Cover } from './Cover'

const meta = {
  title: 'Atoms/Cover',
  component: Cover,
  args: { alt: 'Portada de ejemplo', className: 'w-40 rounded-lg' },
} satisfies Meta<typeof Cover>
export default meta
type Story = StoryObj<typeof meta>

export const WithImage: Story = { args: { src: 'https://usercontent.jamendo.com?type=album&id=24&width=300' } }
export const Placeholder: Story = { args: { src: null } }
export const BrokenImage: Story = { args: { src: 'https://example.invalid/portada.jpg' } }
