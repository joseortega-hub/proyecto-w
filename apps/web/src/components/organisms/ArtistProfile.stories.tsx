import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { Item } from '@/lib/api'
import { ArtistProfile } from './ArtistProfile'

const song = (n: number, title: string, artist: string): Item => ({ id: `s${n}`, domainId: 'perreo', source: 'youtube', externalId: `v${n}`, title, subtitle: artist, description: null, imageUrl: null, mediaUrl: null, externalUrl: null, durationSec: 200 + n * 7, attributes: {}, tags: [], popularity: 0.5 })

const meta = {
  title: 'Organisms/ArtistProfile',
  component: ArtistProfile,
  args: {
    artist: {
      slug: 'wisin', name: 'Wisin', realName: 'Juan Luis Morera Luna', birthDate: '1978-12-19', country: 'Puerto Rico', city: 'Cayey', countries: ['Puerto Rico'], debutYear: 1998, fame: 90, listeners: 3_100_000, styles: ['perreo', 'old school'],
      labels: [{ name: 'Machete Music', start: 2008, end: 2012 }, { name: 'Sony Music Latin', start: 2014, end: null }],
      links: { spotify: 'https://open.spotify.com/artist/3E6xrwgnVfYCrCs0ePERDz', instagram: 'https://www.instagram.com/wisin' },
      bio: 'Juan Luis Morera Luna, conocido como Wisin, es un cantante puertorriqueño de reguetón.', bioSource: 'Wikipedia (CC BY-SA 4.0)', similar: ['yandel'], followed: false, kind: 'artist', incomplete: false,
    },
    similar: [{ slug: 'yandel', name: 'Yandel', country: 'Puerto Rico', city: null, countries: ['Puerto Rico'], debutYear: 1998, fame: 88, styles: [], labels: [], followed: false, kind: 'artist', incomplete: false }],
    alsoFollow: [],
    firstList: [song(1, 'Mi Mejor Amigo', 'Wisin'), song(2, 'Rakata', 'Wisin & Yandel'), song(3, 'Pam Pam', 'Yandel')],
    photoUrl: null,
    onPlay: fn(), onMakeList: fn(), onOpenArtist: fn(),
  },
  decorators: [(Story) => <div data-domain="perreo" className="max-w-2xl p-4"><Story /></div>],
} satisfies Meta<typeof ArtistProfile>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Followed: Story = {
  args: {
    artist: { ...meta.args.artist, followed: true, kind: 'artist', incomplete: false },
    alsoFollow: [{ slug: 'feid', name: 'Feid', country: 'Colombia', city: null, countries: ['Colombia'], debutYear: 2011, fame: 95, styles: [], labels: [], followed: true, kind: 'artist', incomplete: false }],
  },
}
export const Playing: Story = { args: { activeItemId: 's2', playing: true } }
export const Minimal: Story = { args: { firstList: [], similar: [], artist: { slug: 'x', name: 'Dei V', realName: null, birthDate: null, country: null, city: null, countries: [], debutYear: null, fame: 5, listeners: null, styles: [], labels: [], links: {}, bio: null, bioSource: null, similar: [], followed: false, kind: 'artist', incomplete: false } } }
