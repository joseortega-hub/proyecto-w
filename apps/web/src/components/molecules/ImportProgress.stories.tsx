import type { Meta, StoryObj } from '@storybook/react-vite'
import { ImportProgress } from './ImportProgress'

const meta = {
  title: 'Molecules/ImportProgress',
  component: ImportProgress,
  decorators: [(Story) => <div data-domain="youtube" className="max-w-md"><Story /></div>],
  args: { step: 'Leyendo tus listas (3/12): Perreo 2026', found: 0, analyzed: 0, embedded: 0, running: true },
} satisfies Meta<typeof ImportProgress>
export default meta
type Story = StoryObj<typeof meta>

export const Reading: Story = {}
export const Analyzing: Story = { args: { step: 'Analizando tus canciones con IA (48/184)', found: 184, analyzed: 48 } }
export const Embedding: Story = {
  args: { step: 'Preparando la búsqueda semántica (100/184)', found: 184, analyzed: 184, embedded: 100 },
}
export const Done: Story = { args: { step: 'Listo', found: 184, analyzed: 184, embedded: 184, running: false } }
