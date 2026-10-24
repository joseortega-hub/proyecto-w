import type { Meta, StoryObj } from '@storybook/react-vite'
import { techSheet } from '@/lib/details'
import { TechSheet } from './TechSheet'

const meta = {
  title: 'Molecules/TechSheet',
  component: TechSheet,
  decorators: [(Story) => <div className="w-[380px]"><Story /></div>],
} satisfies Meta<typeof TechSheet>
export default meta
type Story = StoryObj<typeof meta>

export const Movie: Story = {
  args: {
    source: 'TMDB',
    rows: techSheet('movies', { director: 'James Gunn', cast: ['Chris Pratt', 'Zoe Saldaña', 'Dave Bautista', 'Vin Diesel'], year: 2014, runtimeMin: 121, rating: 7.9 }),
  },
}
export const Game: Story = {
  args: {
    source: 'RAWG',
    rows: techSheet('games', { developers: ['Team Cherry'], publishers: ['Team Cherry'], released: '2017-02-24', metacritic: 87, platforms: ['PC', 'Nintendo Switch', 'PlayStation 4'] }),
  },
}
export const Book: Story = {
  args: { source: 'Open Library', rows: techSheet('books', { authors: ['Frank Herbert'], year: 1965, pages: 412, subjects: ['ciencia ficción', 'ecología'] }) },
}
export const Song: Story = {
  args: {
    source: 'Jamendo y MusicBrainz',
    rows: techSheet('music', { album: 'Un Verano Sin Ti', year: 2022, producers: ['Tainy', 'La Paciencia'], composers: ['Benito Martínez'], lyricists: ['Benito Martínez'], featured: ['Jhay Cortez'] }),
  },
}
export const Partial: Story = { args: { rows: techSheet('music', { album: 'Marea', year: 2021 }) } }
