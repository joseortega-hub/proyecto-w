import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { DomainCard } from './DomainCard'

const meta = {
  title: 'Molecules/DomainCard',
  component: DomainCard,
  args: { id: 'games', name: 'Videojuegos', icon: 'games', description: '500 videojuegos de RAWG', onSelect: fn() },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof DomainCard>
export default meta
type Story = StoryObj<typeof meta>

export const Games: Story = {}
export const Music: Story = { args: { id: 'music', name: 'Música', icon: 'music', description: '803 canciones de Jamendo' } }
export const Movies: Story = { args: { id: 'movies', name: 'Películas', icon: 'movies', description: '450 películas de TMDB' } }
export const Books: Story = { args: { id: 'books', name: 'Libros', icon: 'books', description: '253 libros de Open Library' } }
export const ComingSoon: Story = { args: { disabled: true, description: 'Próximamente · catálogo de RAWG' } }
