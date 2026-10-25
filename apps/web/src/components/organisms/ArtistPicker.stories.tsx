import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { PerreoArtist } from '@/lib/perreo-types'
import { ArtistPicker } from './ArtistPicker'

const a = (name: string, color: string, aliases: string[] = []): PerreoArtist => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, color, aliases, kind: 'artist', country: null, city: null, countries: [], debutYear: null, fame: 80, styles: [], labels: [], followed: false, incomplete: false })
const ARTISTS = [a('Daddy Yankee', '#e8a23c', ['El Cangri']), a('El Alfa', '#ff4f5e', ['El Jefe']), a('Young Miko', '#9357c9'), a('Feid', '#9cff4a', ['Ferxxo']), a('Tego Calderón', '#2fd3c8')]

const meta = {
  title: 'Organisms/ArtistPicker',
  component: ArtistPicker,
  args: { artists: ARTISTS, selected: [], onChange: () => undefined },
  decorators: [(Story) => <div data-perreo-ui="" data-domain="perreo" style={{ ['--artist' as string]: '#ff4fd0' }} className="w-[360px] p-3 text-white"><Story /></div>],
  render: (args) => {
    const [selected, setSelected] = useState(args.selected)
    return <ArtistPicker {...args} selected={selected} onChange={setSelected} />
  },
} satisfies Meta<typeof ArtistPicker>
export default meta
type Story = StoryObj<typeof meta>

/** Vacío: dos esquinas del ring esperando (el buscador también encuentra «Ferxxo»). */
export const Empty: Story = {}
export const TwoInTheRing: Story = { args: { selected: ['daddy-yankee', 'el-alfa'] } }
export const Full: Story = { args: { selected: ['daddy-yankee', 'el-alfa', 'young-miko', 'feid'] } }
