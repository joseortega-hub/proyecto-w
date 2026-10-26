import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import type { PerreoCompare, PulseArtist } from '@/lib/perreo-pulse'
import { VersusArena } from './VersusArena'

const a = (name: string, color: string): PulseArtist => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, nickname: null, photoV: null, color, countries: [], fame: 90 })
const yankee = a('Daddy Yankee', '#e8a23c')
const alfa = a('El Alfa', '#ff4f5e')
const miko = a('Young Miko', '#9357c9')

const duo: PerreoCompare = {
  updated: '2026-10-25',
  artists: [yankee, alfa],
  values: { [yankee.slug]: { youtubeViews: 21_000_000_000, lastfmListeners: 3_100_000, deezerFans: 9_800_000, releasesYear: 2, fame: 98, yearsActive: 35, albumsPerYear: 0.6 }, [alfa.slug]: { youtubeViews: 4_300_000_000, lastfmListeners: 610_000, deezerFans: 1_200_000, releasesYear: 9, fame: 74, yearsActive: 19, albumsPerYear: 1.5 } },
  profiles: {
    [yankee.slug]: { debutYear: 1992, activeUntil: null, status: 'retired', country: 'Puerto Rico', city: 'San Juan', labels: ['El Cartel Records'], styles: ['reguetón', 'dembow'], topIn: [{ country: 'Puerto Rico', rank: 4 }] },
    [alfa.slug]: { debutYear: 2008, activeUntil: null, status: 'active', country: 'República Dominicana', city: 'Santo Domingo', labels: ['El Jefe Records'], styles: ['dembow'], topIn: [] },
  },
  historyDays: 1,
  result: {
    metrics: [
      { id: 'youtubeViews', label: 'Visitas en YouTube', source: 'YouTube', group: 'audience', scale: 'log', max: 21e9, winners: [yankee.slug], shares: { [yankee.slug]: 1, [alfa.slug]: 0.2 }, bars: { [yankee.slug]: 1, [alfa.slug]: 0.93 } },
      { id: 'lastfmListeners', label: 'Oyentes en Last.fm', source: 'Last.fm', max: 3.1e6, winners: [yankee.slug], shares: { [yankee.slug]: 1, [alfa.slug]: 0.2 } },
      { id: 'deezerFans', label: 'Fans en Deezer', source: 'Deezer', max: 9.8e6, winners: [yankee.slug], shares: { [yankee.slug]: 1, [alfa.slug]: 0.12 } },
      { id: 'releasesYear', label: 'Lanzamientos este año', source: 'Deezer y MusicBrainz', group: 'career', max: 9, winners: [alfa.slug], shares: { [yankee.slug]: 0.22, [alfa.slug]: 1 } },
      { id: 'yearsActive', label: 'Años en activo', source: 'Sintonía', group: 'career', max: 35, winners: [yankee.slug], shares: { [yankee.slug]: 1, [alfa.slug]: 0.54 } },
      { id: 'albumsPerYear', label: 'Discos por año en activo', source: 'Deezer', group: 'career', max: 1.5, winners: [alfa.slug], shares: { [yankee.slug]: 0.4, [alfa.slug]: 1 } },
    ],
    wins: { [yankee.slug]: 3, [alfa.slug]: 1 },
    champion: yankee.slug,
  },
}

const meta = {
  title: 'Organisms/VersusArena',
  component: VersusArena,
  args: { data: duo, onOpenArtist: fn() },
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div data-perreo-ui="" data-domain="perreo" className="w-[380px] p-3 text-white md:w-[640px]"><Story /></div>],
} satisfies Meta<typeof VersusArena>
export default meta
type Story = StoryObj<typeof meta>

/** Dos artistas: entran de los lados, sello «VS», destello y marcador que sube. */
export const Duo: Story = {}

/** Tres o cuatro: caen en rejilla con el «VS» en medio. */
export const Trio: Story = {
  args: {
    data: {
      ...duo,
      artists: [yankee, alfa, miko],
      values: { ...duo.values, [miko.slug]: { youtubeViews: 1_100_000_000, releasesYear: 4, fame: 80 } },
      result: { ...duo.result, wins: { [yankee.slug]: 2, [alfa.slug]: 1, [miko.slug]: 1 }, metrics: duo.result.metrics.map((m) => ({ ...m, shares: { ...m.shares, [miko.slug]: m.id === 'lastfmListeners' || m.id === 'deezerFans' ? null : 0.3 } })) },
    },
  },
}
