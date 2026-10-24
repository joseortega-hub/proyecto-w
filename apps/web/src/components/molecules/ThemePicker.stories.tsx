import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ComponentProps, useState } from 'react'
import { THEMES, type ThemeMode } from '@/lib/theme'
import { ThemePicker } from './ThemePicker'

const meta = {
  title: 'Molecules/ThemePicker',
  component: ThemePicker,
  args: { themes: THEMES, palette: 'sintonia', mode: 'system', theme: 'light', onPalette: () => {}, onMode: () => {} },
  decorators: [(Story) => <div className="w-80 rounded-lg border border-border bg-popover p-2">{Story()}</div>],
} satisfies Meta<typeof ThemePicker>
export default meta
type Story = StoryObj<typeof meta>

function InteractivePicker(args: ComponentProps<typeof ThemePicker>) {
  const [palette, setPalette] = useState(args.palette)
  const [mode, setMode] = useState<ThemeMode>(args.mode)
  return <ThemePicker {...args} palette={palette} mode={mode} onPalette={setPalette} onMode={setMode} />
}

/** Solo muestra la selección: el tema real de la historia se cambia en la barra de Storybook. */
export const Interactivo: Story = {
  render: (args) => <InteractivePicker {...args} />,
}
export const MuestrasEnOscuro: Story = { args: { palette: 'neon', mode: 'dark', theme: 'dark' } }

const mine = {
  id: 'ia-1',
  label: 'Noche urbana',
  description: 'neón, reguetón de noche',
  fonts: [],
  modes: {
    light: { swatches: ['#fbf7ff', '#c0168a', '#0f8aa8', '#fde0f3'], themeColor: '#c0168a' },
    dark: { swatches: ['#0b0414', '#ff3fbf', '#5ee0ff', '#3d1040'], themeColor: '#0b0414' },
  },
}
/** Con un tema propio (con botón de borrar) y la opción de crear otro con IA. */
export const ConTemaPropio: Story = {
  args: { themes: [...THEMES, mine], palette: 'ia-1', customIds: ['ia-1'], onRemove: () => {}, onCreate: () => {} },
}
