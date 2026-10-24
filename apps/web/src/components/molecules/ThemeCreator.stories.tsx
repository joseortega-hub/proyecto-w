import type { Meta, StoryObj } from '@storybook/react-vite'
import { ThemeCreator } from './ThemeCreator'

const proposal = {
  label: 'Noche urbana',
  swatches: ['#0b0414', '#ff3fbf', '#5ee0ff', '#3d1040'],
  notices: ['He aclarado el texto secundario (modo oscuro) para que se lea bien.'],
}

const meta = {
  title: 'Molecules/ThemeCreator',
  component: ThemeCreator,
  args: {
    description: '',
    status: 'idle',
    canSave: true,
    speech: true,
    onDescription: () => {},
    onGenerate: () => {},
    onAnother: () => {},
    onSave: () => {},
    onDiscard: () => {},
  },
  decorators: [(Story) => <div className="w-80 rounded-lg border border-border bg-popover p-2">{Story()}</div>],
} satisfies Meta<typeof ThemeCreator>
export default meta
type Story = StoryObj<typeof meta>

export const Vacio: Story = {}
export const Creando: Story = { args: { description: 'neón, reguetón de noche', status: 'loading' } }
export const ConVistaPrevia: Story = { args: { description: 'neón, reguetón de noche', status: 'ready', proposal } }
export const SinHuecoParaGuardar: Story = { args: { description: 'neón, reguetón de noche', status: 'ready', proposal, canSave: false } }
export const ConError: Story = { args: { description: 'serio y elegante', status: 'error', error: 'La IA no responde ahora mismo. Prueba en un minuto.' } }
