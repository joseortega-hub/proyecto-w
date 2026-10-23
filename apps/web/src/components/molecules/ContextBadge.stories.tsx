import type { Meta, StoryObj } from '@storybook/react-vite'
import { ContextBadge } from './ContextBadge'

const meta = {
  title: 'Molecules/ContextBadge',
  component: ContextBadge,
  args: {
    context: { hora: '21:05', franja: 'noche', diaSemana: 'viernes', finDeSemana: true, tiempo: { descripcion: 'lluvia', temperaturaC: 15, esDeDia: false } },
  },
} satisfies Meta<typeof ContextBadge>
export default meta
type Story = StoryObj<typeof meta>

export const NocheDeLluvia: Story = {}
export const MananaDespejada: Story = {
  args: { context: { hora: '10:30', franja: 'mañana', diaSemana: 'domingo', finDeSemana: true, tiempo: { descripcion: 'despejado', temperaturaC: 22, esDeDia: true } } },
}
/** Sin Open-Meteo: solo el día y la franja. */
export const SinTiempo: Story = { args: { context: { hora: '16:00', franja: 'tarde', diaSemana: 'martes', finDeSemana: false } } }
