import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { RefineChips } from './RefineChips'

const options = [
  { key: 'more-energy', label: '+ energía' },
  { key: 'more-calm', label: '+ calma' },
  { key: 'with-voice', label: 'con voz' },
  { key: 'instrumental', label: 'instrumental' },
]

const meta = {
  title: 'Molecules/RefineChips',
  component: RefineChips,
  args: { options, value: [], onChange: () => undefined },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof RefineChips>
export default meta
type Story = StoryObj<typeof meta>

function InteractiveChips(args: Story['args']) {
  const [value, setValue] = useState<string[]>(['with-voice'])
  return <RefineChips options={args?.options ?? options} value={value} onChange={setValue} />
}

export const Interactive: Story = { render: (args) => <InteractiveChips {...args} /> }
export const Disabled: Story = { args: { value: ['more-energy'], disabled: true } }

const genres = ['Acción', 'Aventura', 'RPG', 'Estrategia', 'Shooter', 'Indie', 'Carreras', 'Deportes', 'Puzle'].map((label) => ({ key: label.toLowerCase(), label }))

function ManyChips() {
  const [value, setValue] = useState<string[]>(['rpg', 'indie'])
  return <RefineChips label="Géneros" options={genres} value={value} onChange={setValue} />
}

/** Con muchas opciones: una sola línea que se desliza; el botón «Géneros» abre la hoja con todas. */
export const Many: Story = { render: () => <ManyChips /> }

/** Ancho de móvil (375 px menos márgenes). */
export const Movil: Story = { render: () => <ManyChips />, decorators: [(Story) => <div className="w-[335px]"><Story /></div>] }
