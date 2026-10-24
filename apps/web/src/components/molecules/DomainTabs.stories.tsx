import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DomainTabs } from './DomainTabs'

const tabs = [
  { id: 'music', label: 'Música', icon: 'music' as const },
  { id: 'youtube', label: 'Mi YouTube', icon: 'music' as const },
  { id: 'folder', label: 'Mi carpeta', icon: 'music' as const },
  { id: 'games', label: 'Videojuegos', icon: 'games' as const },
  { id: 'movies', label: 'Películas', icon: 'movies' as const },
  { id: 'books', label: 'Libros', icon: 'books' as const },
]

const meta = {
  title: 'Molecules/DomainTabs',
  component: DomainTabs,
  args: { tabs, current: 'games', onSelect: fn() },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof DomainTabs>
export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {}
export const Vertical: Story = { args: { orientation: 'vertical', current: 'movies' } }

const wide = tabs.map((t, i) => ({ ...t, count: 40 + i * 120 }))
export const Movil360: Story = {
  args: { tabs: wide, current: 'youtube' },
  decorators: [(Story) => <div className="w-[328px]"><Story /></div>],
}
/** Ancho muy estrecho: no caben y aparece "Todas". */
export const HojaTodas: Story = {
  args: { tabs: wide, current: 'books' },
  decorators: [(Story) => <div className="w-[240px]"><Story /></div>],
  play: async ({ canvasElement }) => {
    const btn = canvasElement.querySelector<HTMLButtonElement>('button[aria-label="Todas las temáticas"]')
    btn?.click()
  },
}
