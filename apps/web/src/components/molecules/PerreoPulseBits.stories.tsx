import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import type { HotEntry, PerreoRelease, PulseArtist } from '@/lib/perreo-pulse'
import { HotRow, PerreoTabs, PulseEmpty, PulseNote, ReleaseCard } from './PerreoPulseBits'

const artist = (name: string, color: string): PulseArtist => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, nickname: null, photoV: null, color, countries: ['Puerto Rico'], fame: 80 })
const release = (title: string, date: string, kind: 'album' | 'song', who: PulseArtist): PerreoRelease => ({ id: title, artistSlug: who.slug, kind, recordType: kind === 'album' ? 'album' : 'single', title, releaseDate: date, coverUrl: null, link: 'https://www.deezer.com', source: 'deezer', fans: 1200, artist: who })
const hot = (who: PulseArtist, score: number, reasons: string[]): HotEntry => ({ slug: who.slug, score, reasons, growth: 0.05, releases: 1, geoRank: 3, artist: who })

const meta = {
  title: 'Molecules/PerreoPulseBits',
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div data-perreo-ui="" data-domain="perreo" style={{ ['--artist' as string]: '#ff4fd0' }} className="flex w-[360px] flex-col gap-3 p-3 text-white"><Story /></div>],
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const alfa = artist('El Alfa', '#ff4f5e')
const mami = artist('Young Miko', '#9357c9')

/** Pestañas de cartel: la activa es una pegatina ladeada. */
export const Tabs: Story = {
  render: () => {
    const [v, setV] = useState('week')
    return <PerreoTabs label="Momento" value={v} onChange={setV} options={[{ value: 'week', label: 'Esta semana', badge: 4 }, { value: 'month', label: 'Este mes', badge: 12 }, { value: 'upcoming', label: 'Lo que viene', badge: 2 }]} />
  },
}

export const Releases: Story = {
  render: () => (
    <>
      <ReleaseCard release={release('Dembow Pa’ La Calle', '2026-10-23', 'song', alfa)} onOpenArtist={fn()} now={new Date('2026-10-25')} />
      <ReleaseCard release={release('Trap Kitty 2', '2026-11-14', 'album', mami)} upcoming onOpenArtist={fn()} now={new Date('2026-10-25')} />
    </>
  ),
}

export const Ranking: Story = {
  render: () => (
    <>
      <HotRow entry={hot(alfa, 90, ['2 lanzamientos', 'Nº 3 en España (Last.fm)'])} position={1} maxScore={90} />
      <HotRow entry={hot(mami, 60, ['+4,2 % de público'])} position={2} maxScore={90} />
    </>
  ),
}

export const Notes: Story = {
  render: () => (
    <>
      <PulseNote updated="2026-10-25" />
      <PulseEmpty text="Aún no hay novedades cargadas." />
    </>
  ),
}
