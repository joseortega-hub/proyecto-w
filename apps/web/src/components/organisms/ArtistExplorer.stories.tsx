import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { NO_FILTERS, type PerreoArtistList, type PerreoFilters } from '@/lib/perreo-types'
import { ArtistExplorer } from './ArtistExplorer'

const artists = [
  { slug: 'wisin', name: 'Wisin', country: 'Puerto Rico', city: 'Cayey', countries: ['Puerto Rico'], debutYear: 1998, fame: 90, styles: ['perreo', 'old school'], labels: ['Sony Music Latin'] },
  { slug: 'feid', name: 'Feid', country: 'Colombia', city: 'Medellín', countries: ['Colombia'], debutYear: 2011, fame: 95, styles: ['romántico', 'perreo'], labels: ['Universal Music Latino'] },
  { slug: 'dei-v', name: 'Dei V', country: 'Puerto Rico', city: 'Carolina', countries: ['Puerto Rico'], debutYear: 2020, fame: 12, styles: ['trap'], labels: [] },
  { slug: 'el-alfa', name: 'El Alfa', country: 'República Dominicana', city: 'San Cristóbal', countries: ['República Dominicana'], debutYear: 2008, fame: 70, styles: ['dembow'], labels: [] },
]
const data: PerreoArtistList = {
  artists,
  total: 66,
  facets: {
    countries: [{ value: 'Puerto Rico', count: 55 }, { value: 'Colombia', count: 4 }, { value: 'República Dominicana', count: 3 }],
    cities: [{ value: 'Carolina', count: 9 }, { value: 'San Juan', count: 12 }],
    eras: [{ value: 'old-school', label: 'Old school (antes de 2005)', count: 14 }, { value: '2020', label: 'Desde 2020', count: 6 }],
    labels: [{ value: 'Sony Music Latin', count: 8 }],
    styles: [{ value: 'perreo', count: 40 }, { value: 'trap', count: 22 }],
  },
}

const meta = {
  title: 'Organisms/ArtistExplorer',
  component: ArtistExplorer,
  args: { filters: NO_FILTERS, onChange: fn(), data, photoUrl: () => '', onOpen: fn() },
  decorators: [(Story) => <div data-domain="perreo" className="max-w-5xl p-4"><Story /></div>],
  render: (args) => {
    const [filters, setFilters] = useState<PerreoFilters>(args.filters)
    return <ArtistExplorer {...args} filters={filters} onChange={setFilters} />
  },
} satisfies Meta<typeof ArtistExplorer>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithFilters: Story = { args: { filters: { ...NO_FILTERS, country: 'Puerto Rico', style: 'perreo', fameMin: 40 } } }
export const NoResults: Story = { args: { data: { ...data, artists: [] } } }
export const Loading: Story = { args: { data: undefined } }
