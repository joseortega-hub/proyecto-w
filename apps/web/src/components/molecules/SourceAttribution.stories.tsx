import type { Meta, StoryObj } from '@storybook/react-vite'
import { SourceAttribution } from './SourceAttribution'

const meta = {
  title: 'Molecules/SourceAttribution',
  component: SourceAttribution,
  args: { name: 'RAWG', url: 'https://rawg.io', attribution: 'Datos e imágenes de videojuegos de RAWG.' },
  decorators: [(Story) => <div className="w-[350px]"><Story /></div>],
} satisfies Meta<typeof SourceAttribution>
export default meta
type Story = StoryObj<typeof meta>

export const Rawg: Story = {}
export const Tmdb: Story = {
  args: { name: 'TMDB', url: 'https://www.themoviedb.org', attribution: 'This product uses the TMDB API but is not endorsed or certified by TMDB.' },
}
