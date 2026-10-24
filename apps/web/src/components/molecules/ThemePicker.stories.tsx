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
