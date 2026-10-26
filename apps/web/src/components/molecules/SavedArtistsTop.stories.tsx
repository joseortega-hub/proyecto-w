import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import type { PerreoArtist } from '@/lib/perreo-types'
import { SavedArtistsTop } from './SavedArtistsTop'

const artist = (slug: string, name: string, color: string) => ({ slug, name, color, photoV: null }) as PerreoArtist

const meta = {
  title: 'Molecules/SavedArtistsTop',
  component: SavedArtistsTop,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div data-perreo-ui="" className="bg-black p-4" style={{ ['--artist' as string]: '#ff4fd0' }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {
    top: [
      { artist: artist('bad-bunny', 'Bad Bunny', '#ffd400'), count: 23 },
      { artist: artist('feid', 'Feid', '#7ddc1f'), count: 11 },
      { artist: artist('karol-g', 'Karol G', '#ff4fd0'), count: 1 },
    ],
  },
} satisfies Meta<typeof SavedArtistsTop>

export default meta
type Story = StoryObj<typeof meta>

export const Podio: Story = {}
