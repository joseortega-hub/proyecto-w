import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router'
import { PerreoArtistLinks } from './PerreoArtistLinks'

const meta = {
  title: 'Molecules/PerreoArtistLinks',
  component: PerreoArtistLinks,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: { artists: [{ slug: 'bad-bunny', name: 'Bad Bunny' }] },
} satisfies Meta<typeof PerreoArtistLinks>

export default meta
type Story = StoryObj<typeof meta>

export const UnArtista: Story = {}
export const Colaboracion: Story = { args: { artists: [{ slug: 'feid', name: 'Feid' }, { slug: 'myke-towers', name: 'Myke Towers' }] } }
