import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DomainPicker } from './DomainPicker'

const tabs = [
  { id: 'music', label: 'Música', icon: 'music' as const, count: 1200 },
  { id: 'youtube', label: 'Mi YouTube', icon: 'youtube' as const, count: 340 },
  { id: 'folder', label: 'Mi carpeta', icon: 'folder' as const, count: 52 },
  { id: 'games', label: 'Videojuegos', icon: 'games' as const, count: 800 },
  { id: 'movies', label: 'Películas', icon: 'movies' as const, count: 950 },
  { id: 'books', label: 'Libros', icon: 'books' as const, count: 610 },
]

const meta = {
  title: 'Molecules/DomainPicker',
  component: DomainPicker,
  args: { tabs, current: 'youtube', onSelect: fn() },
} satisfies Meta<typeof DomainPicker>
export default meta
type Story = StoryObj<typeof meta>

/** En la cabecera: la temática actual y una hoja con todas. */
export const Cabecera: Story = {}
/** Hueco de la barra inferior (estructura «Una mano»). */
export const BarraInferior: Story = {
  args: { variant: 'tab', current: 'movies' },
  decorators: [(Story) => <div className="grid w-20"><Story /></div>],
}
export const HojaAbierta: Story = {
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')?.click()
  },
}
