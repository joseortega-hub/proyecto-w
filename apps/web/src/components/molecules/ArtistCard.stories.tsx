import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { ArtistCard } from './ArtistCard'

const meta = {
  title: 'Molecules/ArtistCard',
  component: ArtistCard,
  args: { name: 'Wisin', country: 'Puerto Rico', debutYear: 1998, fame: 88, styles: ['perreo', 'romántico', 'old school'], onOpen: fn() },
  decorators: [(Story) => <div data-domain="perreo" className="w-[180px]"><Story /></div>],
} satisfies Meta<typeof ArtistCard>
export default meta
type Story = StoryObj<typeof meta>

/** Sin foto: las iniciales sobre el color de la temática. */
export const WithoutPhoto: Story = {}
export const Underground: Story = { args: { name: 'Dei V', country: 'Puerto Rico', debutYear: 2020, fame: 6, styles: ['trap'] } }
export const TwoCountries: Story = { args: { name: 'Nicky Jam', country: 'Puerto Rico / Estados Unidos', fame: 71 } }
export const Followed: Story = { args: { name: 'Feid', country: 'Colombia', debutYear: 2011, fame: 95, styles: ['romántico'], followed: true } }
