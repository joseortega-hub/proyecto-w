import type { Meta, StoryObj } from '@storybook/react-vite'
import { MicButton } from './MicButton'

const meta = {
  title: 'Atoms/MicButton',
  component: MicButton,
  args: { listening: false, onClick: () => {} },
  decorators: [(Story) => <div data-domain="music">{Story()}</div>],
} satisfies Meta<typeof MicButton>
export default meta
type Story = StoryObj<typeof meta>

export const Reposo: Story = {}
export const Escuchando: Story = { args: { listening: true } }
export const Desactivado: Story = { args: { disabled: true } }
