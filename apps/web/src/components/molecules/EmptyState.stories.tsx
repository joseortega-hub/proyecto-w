import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@/components/atoms'
import { EmptyState } from './EmptyState'

const meta = {
  title: 'Molecules/EmptyState',
  component: EmptyState,
  args: {
    icon: 'lists',
    title: 'Aún no has guardado ninguna lista',
    description: 'Al terminar una entrevista, pulsa Guardar y la tendrás aquí.',
  },
} satisfies Meta<typeof EmptyState>
export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = { args: { action: <Button>Empezar una entrevista</Button> } }
export const Failure: Story = {
  args: {
    icon: 'retry',
    title: 'Se ha torcido algo al afinar',
    description: 'Gemini no ha respondido a tiempo.',
    action: <Button>Reintentar</Button>,
  },
}
