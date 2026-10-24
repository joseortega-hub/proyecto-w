import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DomainTile } from './DomainTile'

const meta = {
  title: 'Molecules/DomainTile',
  component: DomainTile,
  args: { id: 'music', name: 'Música', icon: 'music', description: '803 canciones de Jamendo', onOpen: fn() },
  decorators: [(Story) => <div className="w-[350px] md:w-[460px]"><Story /></div>],
} satisfies Meta<typeof DomainTile>
export default meta
type Story = StoryObj<typeof meta>

export const New: Story = {}
export const WithLastList: Story = { args: { lastList: 'Noche de after · hace 2 días', action: { label: 'Continuar', onClick: fn() } } }
export const Games: Story = { args: { id: 'games', name: 'Videojuegos', icon: 'games', description: '500 videojuegos de RAWG', lastList: 'Sofá y buen rollo · ayer', action: { label: 'Continuar', onClick: fn() } } }
export const Movies: Story = { args: { id: 'movies', name: 'Películas', icon: 'movies', description: '450 películas de TMDB' } }
export const Books: Story = { args: { id: 'books', name: 'Libros', icon: 'books', description: '253 libros de Open Library' } }
export const Personal: Story = { args: { id: 'youtube', name: 'Mi YouTube', icon: 'youtube', description: 'Conecta tu YouTube y usa tu propia música' } }
export const ComingSoon: Story = { args: { disabled: true, description: 'Próximamente · catálogo de RAWG' } }
