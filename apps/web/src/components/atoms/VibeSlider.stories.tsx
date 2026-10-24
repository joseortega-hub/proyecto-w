import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { VibeSlider } from './VibeSlider'

function Live(args: ComponentProps<typeof VibeSlider>) {
  const [value, setValue] = useState(args.value)
  return <VibeSlider {...args} value={value} onChange={setValue} valueText={`${args.label}: ${Math.round(value * 100)}`} />
}

const meta = {
  title: 'Atoms/VibeSlider',
  component: VibeSlider,
  args: { label: 'Energía', value: 0.6, valueText: 'Energía', variant: 'eq', solid: true },
  render: (args) => <Live {...args} />,
  decorators: [(Story) => <div className="w-[300px] p-4"><Story /></div>],
} satisfies Meta<typeof VibeSlider>
export default meta
type Story = StoryObj<typeof meta>

export const Ecualizador: Story = {}
export const EcualizadorSupuesto: Story = { args: { solid: false } }
export const HudVideojuegos: Story = { args: { variant: 'hud', label: 'Intensidad', value: 0.8 } }
export const ClaquetaPeliculas: Story = { args: { variant: 'cine', label: 'Ritmo', value: 0.5 } }
export const ClaquetaSupuesta: Story = { args: { variant: 'cine', label: 'Ritmo', value: 0.5, solid: false } }
export const MarcapaginasLibros: Story = { args: { variant: 'book', label: 'Ritmo', value: 0.65 } }
export const Reordenando: Story = { args: { disabled: true } }

/** Modo edición (táctil): se arrastra de inmediato y no deja hacer scroll. Sin él, pulsación larga de ~300 ms. */
export const ModoEdicion: Story = { args: { editing: true } }
